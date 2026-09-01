import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { flowClassColumns } from "@/lib/utils/flow-class-columns";
import { parseBancolombiaEmail } from "@/lib/parsers/bancolombia-email";
import { resolveSuggestedEmailAccountId } from "@/lib/email-ingest/account-matching";
import { findEmailDuplicateCandidate } from "@/lib/email-ingest/duplicate-check";
import { normalizeEmailTime } from "@/lib/email-ingest/time";
import {
  computePdfHash,
  filterPdfAttachments,
  isPdfEncrypted,
  parsePdfBuffer,
  type ResendAttachment,
} from "@/lib/email-ingest/pdf-handler";
import {
  parseStatementFilename,
  matchAccountByLast4,
} from "@/lib/email-ingest/statement-filename";
import { computeIdempotencyKey } from "@/lib/utils/idempotency";
import { applyAccountBalanceDelta } from "@/lib/utils/account-balance";
import { autoCategorize } from "@zeta/shared";
import { matchTransactionToDestinatario } from "@/actions/destinatarios";
import { linkTransactionToOccurrence } from "@/actions/occurrences";
import { revalidateFinancialViewsFromWebhook } from "@/lib/cache/revalidation";
import type { Json } from "@/types/database";

// ── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_SENDERS = [
  "alertasynotificaciones@an.notificacionesbancolombia.com",
  "extractosbancolombia@extractos.documentosbancolombia.com",
];
const RATE_LIMIT_PER_DAY = 100;

// ── Types ────────────────────────────────────────────────────────────────────

type ResendEmailPayload = {
  type: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject?: string;
  };
};

type ResendEmailContent = {
  text: string | null;
  html: string | null;
  attachments: ResendAttachment[];
};

type LogStatus =
  | "parsed"
  | "imported"
  | "queued"
  | "duplicate"
  | "parse_failed"
  | "sender_rejected"
  | "rate_limited"
  | "pdf_queued"
  | "pdf_parse_failed"
  | "pdf_imported";

// ── Signature verification ───────────────────────────────────────────────────

async function verifyResendSignature(request: NextRequest, body: string): Promise<boolean> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") return false;
    console.warn("[email-ingest] RESEND_WEBHOOK_SECRET not set — skipping signature verification (dev mode)");
    return true;
  }

  // Svix headers
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return false;
  }

  // Build signed content: "<svix-id>.<svix-timestamp>.<body>"
  const signedContent = `${svixId}.${svixTimestamp}.${body}`;

  // Decode base64 secret (Svix format: "whsec_<base64>")
  const secretBase64 = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const secretBytes = Uint8Array.from(atob(secretBase64), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedContent),
  );

  const computedSig =
    "v1," + btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

  // svix-signature may contain multiple signatures: "v1,sig1 v1,sig2"
  const signatures = svixSignature.split(" ");
  return signatures.some((sig) => sig === computedSig);
}

// ── Rate limit check ─────────────────────────────────────────────────────────

async function checkRateLimit(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { count } = await admin
    .from("email_ingest_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfDay.toISOString());

  return (count ?? 0) < RATE_LIMIT_PER_DAY;
}

// ── Fetch email content from Resend API ─────────────────────────────────────

type ResendAttachmentMeta = {
  id: string;
  filename: string;
  content_type: string;
  download_url: string;
};

async function fetchAttachmentList(
  emailId: string,
  apiKey: string,
): Promise<ResendAttachmentMeta[]> {
  const res = await fetch(
    `https://api.resend.com/emails/receiving/${emailId}/attachments`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (!res.ok) {
    console.error(
      `[email-ingest] List attachments failed: ${res.status} ${res.statusText}`,
    );
    return [];
  }
  const json = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list: ResendAttachmentMeta[] = (json.data ?? []).map((a: any) => ({
    id: a.id ?? "",
    filename: a.filename ?? "attachment.pdf",
    content_type: a.content_type ?? a.contentType ?? "",
    download_url: a.download_url ?? a.downloadUrl ?? "",
  }));
  return list.filter((a) => a.download_url);
}

async function downloadAttachment(meta: ResendAttachmentMeta): Promise<Uint8Array | null> {
  const res = await fetch(meta.download_url);
  if (!res.ok) {
    console.error(
      `[email-ingest] Download ${meta.filename} failed: ${res.status} ${res.statusText}`,
    );
    return null;
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

async function fetchEmailContent(emailId: string): Promise<ResendEmailContent | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[email-ingest] RESEND_API_KEY not set — cannot fetch email content");
    return null;
  }

  const [contentRes, attachmentList] = await Promise.all([
    fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    }),
    fetchAttachmentList(emailId, apiKey),
  ]);

  if (!contentRes.ok) {
    console.error(
      `[email-ingest] Resend API error: ${contentRes.status} ${contentRes.statusText}`,
    );
    return null;
  }

  const data = await contentRes.json();

  const attachments: ResendAttachment[] = (
    await Promise.all(
      attachmentList.map(async (meta) => {
        const bytes = await downloadAttachment(meta);
        if (!bytes || bytes.length === 0) return null;
        return {
          filename: meta.filename,
          content_type: meta.content_type,
          bytes,
        };
      }),
    )
  ).filter((a): a is ResendAttachment => a !== null);

  return { text: data.text ?? null, html: data.html ?? null, attachments };
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Log helper ───────────────────────────────────────────────────────────────

function buildRawBodyPreview(subject: string | null, body: string | null): string | null {
  if (!subject && !body) return null;
  const parts: string[] = [];
  if (subject) parts.push(`[Subject: ${subject}]`);
  if (body) parts.push(body);
  return parts.join("\n").slice(0, 800);
}

async function insertLog(params: {
  userId: string | null;
  emailIngestId: string | null;
  fromAddress: string;
  status: LogStatus;
  rawBody: string | null;
  errorMessage: string | null;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("email_ingest_logs").insert({
    user_id: params.userId,
    email_ingest_id: params.emailIngestId,
    from_address: params.fromAddress,
    status: params.status,
    raw_body: params.rawBody ? params.rawBody.slice(0, 800) : null,
    error_message: params.errorMessage,
  });
  if (error) {
    console.error("[email-ingest] Failed to insert log:", error.message, params);
  }
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Read body once (needed for both signature verification and JSON parsing)
  const rawBody = await request.text();

  // 1. Verify Resend webhook signature
  const isValid = await verifyResendSignature(request, rawBody);
  if (!isValid) {
    console.warn("[email-ingest] Signature verification failed — rejecting webhook");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 2. Parse JSON payload
  let payload: ResendEmailPayload;
  try {
    payload = JSON.parse(rawBody) as ResendEmailPayload;
  } catch (e) {
    console.error("[email-ingest] JSON parse error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: true });
  }

  // Only handle email.received events
  if (payload.type !== "email.received") {
    console.log(`[email-ingest] Ignoring event type: ${payload.type}`);
    return NextResponse.json({ ok: true });
  }

  const { from, to, subject, email_id: emailId } = payload.data;
  console.log(`[email-ingest][${emailId}] Received email from=${from} to=${to?.[0]} subject="${subject ?? "(none)"}"`);

  try {
    return await processEmail({ emailId, from, to, subject });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(`[email-ingest][${emailId}] Unhandled error:`, message, stack);
    // Best-effort DB log — may fail if the error is a DB connection issue
    await insertLog({
      userId: null,
      emailIngestId: null,
      fromAddress: from ?? "unknown",
      status: "parse_failed",
      rawBody: buildRawBodyPreview(subject ?? null, null),
      errorMessage: `Unhandled error: ${message}`,
    }).catch(() => {});
    // Return 200 to prevent Resend retries that would keep failing
    return NextResponse.json({ ok: true });
  }
}

async function processEmail(ctx: {
  emailId: string;
  from: string;
  to: string[];
  subject?: string;
}) {
  const { emailId, from, to, subject } = ctx;

  // Webhook payload has metadata only — fetch full email content from Resend API
  const emailContent = await fetchEmailContent(emailId);
  const emailText = emailContent?.text ?? null;
  const emailHtml = emailContent?.html ?? null;
  // Prefer plain text; fall back to stripped HTML
  const emailBody = emailText || (emailHtml ? stripHtml(emailHtml) : "");
  const rawBodyPreview = buildRawBodyPreview(subject ?? null, emailBody);

  // 3. Extract address key from recipient (e.g. "u_abc123@domain.com" → "u_abc123")
  //    Resend lowercases the `to` on direct inbound emails, so normalize here
  //    and use case-insensitive lookup below.
  const recipientEmail = to?.[0] ?? "";
  const addressKey = recipientEmail.split("@")[0] ?? "";

  if (!addressKey) {
    console.warn(`[email-ingest][${emailId}] No address_key in recipient: ${recipientEmail}`);
    await insertLog({
      userId: null,
      emailIngestId: null,
      fromAddress: from,
      status: "parse_failed",
      rawBody: rawBodyPreview,
      errorMessage: `Could not extract address_key from recipient: ${recipientEmail}`,
    });
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient();

  // 4. Look up email_ingest_addresses via RPC that can decrypt encrypted columns.
  //    The admin client has no JWT, so zeta_decrypt() in the view returns NULL for
  //    encrypted fields (allowed_sender, gmail_verification_url). The RPC uses
  //    zeta_decrypt_as() with the row's user_id to decrypt correctly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ingestAddress, error: lookupError } = await (admin as any)
    .rpc("get_email_ingest_settings", { p_address_key: addressKey })
    .maybeSingle() as { data: {
      id: string; user_id: string; account_id: string | null;
      auto_import: boolean; allowed_sender: string | null;
      pdf_import_enabled: boolean; address_key: string;
      allowed_senders: string[];
    } | null; error: { message: string; code?: string } | null };

  if (lookupError) {
    console.error(`[email-ingest][${emailId}] RPC get_email_ingest_settings failed:`, lookupError.message);
  }

  if (!ingestAddress) {
    const detail = lookupError ? ` (DB error: ${lookupError.message})` : "";
    console.warn(`[email-ingest][${emailId}] No active ingest address for key="${addressKey}"${detail}`);
    await insertLog({
      userId: null,
      emailIngestId: null,
      fromAddress: from,
      status: "parse_failed",
      rawBody: rawBodyPreview,
      errorMessage: `No active ingest address found for key: ${addressKey}${detail}`,
    });
    return NextResponse.json({ ok: true });
  }

  const {
    id: emailIngestId,
    user_id: userId,
    account_id: defaultAccountId,
    auto_import: autoImport,
    allowed_sender: allowedSender,
    pdf_import_enabled: pdfImportEnabled,
    allowed_senders: userAllowedSenders,
  } = ingestAddress;

  // 5. Detect Gmail forwarding verification emails
  const fromLower = from.toLowerCase();
  // Extract bare email from potential "Name <email>" format for sender validation
  const fromEmail = fromLower.match(/<([^>]+)>/)?.[1] ?? fromLower.trim();

  if (fromEmail.includes("forwarding-noreply@google.com")) {
    const verificationContent = emailBody || emailHtml || "";
    const verifyMatch = verificationContent.match(
      /https:\/\/mail\.google\.com\/mail\/vf-[^\s"<>]+/
    );
    if (verifyMatch) {
      // Use RPC to write encrypted column — admin client has no JWT,
      // so zeta_encrypt() in the view trigger fails without auth.uid().
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: verifyError } = await (admin as any)
        .rpc("set_gmail_verification", {
          p_ingest_id: emailIngestId,
          p_user_id: userId,
          p_url: verifyMatch[0],
        });
      if (verifyError) {
        console.error(`[email-ingest][${emailId}] Failed to save Gmail verification URL:`, verifyError.message);
      }
    }
    await insertLog({
      userId,
      emailIngestId,
      fromAddress: from,
      status: "queued",
      rawBody: rawBodyPreview,
      errorMessage: verifyMatch
        ? "Gmail verification URL captured"
        : "Gmail verification email received but no URL found",
    });
    return NextResponse.json({ ok: true });
  }

  // 6. Validate sender — accept bank notifications, user's forwarding email, user-configured senders, or the ingest address itself
  const isBankSender = ALLOWED_SENDERS.some((s) => fromEmail.includes(s));
  const isAllowedSender = allowedSender && fromEmail.includes(allowedSender.toLowerCase());
  // Allow the ingest address itself as sender (Resend internal routing edge case).
  // Match full local-part + "@" to prevent substring spoofing.
  const isSelfSender = fromEmail.startsWith(`${addressKey.toLowerCase()}@`);

  // Check user-configured allowed senders (loaded from RPC, no extra round-trip)
  const isUserConfiguredSender = (userAllowedSenders ?? []).some(
    (s) => fromEmail === s.toLowerCase()
  );

  if (!isBankSender && !isAllowedSender && !isSelfSender && !isUserConfiguredSender) {
    console.log(`[email-ingest][${emailId}] Sender rejected: "${from}" (allowed_sender=${allowedSender ?? "none"})`);
    await insertLog({
      userId,
      emailIngestId,
      fromAddress: from,
      status: "sender_rejected",
      rawBody: rawBodyPreview,
      errorMessage: `Sender not allowed: ${from}`,
    });
    return NextResponse.json({ ok: true });
  }

  console.log(`[email-ingest][${emailId}] Sender OK (bank=${isBankSender}, allowed=${!!isAllowedSender}, self=${isSelfSender}, userConfigured=${isUserConfiguredSender}), user=${userId}`);

  // 7. Rate limit: max 100 emails/day/user
  const withinLimit = await checkRateLimit(userId);
  if (!withinLimit) {
    console.log(`[email-ingest][${emailId}] Rate limited (${RATE_LIMIT_PER_DAY}/day)`);
    await insertLog({
      userId,
      emailIngestId,
      fromAddress: from,
      status: "rate_limited",
      rawBody: rawBodyPreview,
      errorMessage: `Rate limit exceeded (${RATE_LIMIT_PER_DAY}/day)`,
    });
    return NextResponse.json({ ok: true });
  }

  // 7a. If Resend API failed, log and store as unrecognized — don't proceed with empty data
  if (!emailContent) {
    console.error(`[email-ingest][${emailId}] No email content available — Resend API fetch failed`);
    await insertLog({
      userId,
      emailIngestId,
      fromAddress: from,
      status: "parse_failed",
      rawBody: rawBodyPreview,
      errorMessage: `Resend API fetch failed for email_id=${emailId} — no content available`,
    });
    const { error: unrecognizedError } = await admin.from("unrecognized_emails").insert({
      user_id: userId,
      email_ingest_id: emailIngestId,
      from_address: from,
      subject: subject ?? null,
      text_body: null,
      html_body: null,
      status: "pending",
    });
    if (unrecognizedError) {
      console.error(`[email-ingest][${emailId}] Failed to insert unrecognized_email:`, unrecognizedError.message);
    }
    revalidateTag("email-ingest", "zeta");
    return NextResponse.json({ ok: true });
  }

  // 7b. Try text parsing FIRST — it's instant (regex). PDF is the fallback.
  console.log(`[email-ingest][${emailId}] Parsing email body (${emailBody.length} chars, hasText=${!!emailText}, hasHtml=${!!emailHtml})`);
  const parsed = emailBody.trim() ? parseBancolombiaEmail(emailBody) : null;

  if (parsed) {
    console.log(`[email-ingest][${emailId}] Text parsed: pattern=${parsed.pattern_type} amount=${parsed.amount} direction=${parsed.direction} card=${parsed.card_last4} — skipping PDF fallback`);
  }

  // 7c. If text parsing failed, fall back to PDF attachments
  if (!parsed) {
    const pdfAttachments = filterPdfAttachments(emailContent.attachments);

    if (pdfAttachments.length > 0 && pdfImportEnabled) {
      console.log(`[email-ingest][${emailId}] Text parse failed — falling back to ${pdfAttachments.length} PDF attachment(s)`);
      const insertedPdfRows: Array<{ id: string; buffer: Uint8Array; filename: string }> = [];

      for (const attachment of pdfAttachments) {
        const filename = attachment.filename || "attachment.pdf";
        const bytes = attachment.bytes;

        const isPdf =
          bytes.length >= 4 &&
          bytes[0] === 0x25 &&
          bytes[1] === 0x50 &&
          bytes[2] === 0x44 &&
          bytes[3] === 0x46;

        if (!isPdf) {
          console.error(
            `[email-ingest][${emailId}] ${filename}: bytes missing or not a PDF (len=${bytes.length}, first4=${Array.from(bytes.slice(0, 4)).join(",")})`,
          );
          await insertLog({
            userId,
            emailIngestId,
            fromAddress: from,
            status: "pdf_parse_failed",
            rawBody: rawBodyPreview,
            errorMessage: `Attachment ${filename} missing or not a PDF`,
          });
          continue;
        }

        const contentHash = await computePdfHash(bytes);

        // Check idempotency: skip if we already have this PDF.
        // Exception: if the prior row failed (parse_failed, needs_password) or
        // was never parsed due to Resend 0-byte attachment bug, dismiss it so
        // the user can resend and retry. Otherwise dead-letter blocks retry.
        const { data: existing } = await admin
          .from("pending_email_statements")
          .select("id, status")
          .eq("user_id", userId)
          .eq("idempotency_hash", contentHash)
          .not("status", "in", "(dismissed)")
          .maybeSingle();

        if (existing) {
          const retryableStatuses = ["parse_failed", "needs_password"];
          if (retryableStatuses.includes(existing.status)) {
            await admin
              .from("pending_email_statements")
              .update({
                status: "dismissed",
                updated_at: new Date().toISOString(),
              })
              .eq("id", existing.id)
              .eq("user_id", userId);
            console.log(
              `[email-ingest][${emailId}] Retryable row ${existing.id} dismissed (status=${existing.status}) — proceeding with fresh insert`,
            );
          } else {
            await insertLog({
              userId,
              emailIngestId,
              fromAddress: from,
              status: "duplicate",
              rawBody: rawBodyPreview,
              errorMessage: `Duplicate PDF: ${filename}`,
            });
            continue;
          }
        }

        // Store PDF in Supabase Storage
        const timestamp = Date.now();
        const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `${userId}/${timestamp}-${safeName}`;

        const { error: uploadError } = await admin.storage
          .from("email-pdfs")
          .upload(storagePath, bytes, {
            contentType: "application/pdf",
            upsert: false,
          });

        if (uploadError) {
          await insertLog({
            userId,
            emailIngestId,
            fromAddress: from,
            status: "pdf_parse_failed",
            rawBody: rawBodyPreview,
            errorMessage: `Storage upload failed: ${uploadError.message}`,
          });
          continue;
        }

        // Insert pending row with status 'pending'
        const { data: inserted, error: insertError } = await admin
          .from("pending_email_statements")
          .insert({
            user_id: userId,
            email_ingest_id: emailIngestId,
            from_address: from,
            subject: subject ?? null,
            original_filename: filename,
            storage_path: storagePath,
            file_size_bytes: bytes.byteLength,
            status: "pending",
            idempotency_hash: contentHash,
          })
          .select("id")
          .single();

        if (insertError) {
          await admin.storage.from("email-pdfs").remove([storagePath]);
          if (insertError.code === "23505") {
            await insertLog({
              userId,
              emailIngestId,
              fromAddress: from,
              status: "duplicate",
              rawBody: rawBodyPreview,
              errorMessage: `Duplicate PDF statement: ${filename}`,
            });
          } else {
            await insertLog({
              userId,
              emailIngestId,
              fromAddress: from,
              status: "pdf_parse_failed",
              rawBody: rawBodyPreview,
              errorMessage: `Insert error: ${insertError.message}`,
            });
          }
          continue;
        }

        insertedPdfRows.push({ id: inserted.id, buffer: bytes, filename });

        await insertLog({
          userId,
          emailIngestId,
          fromAddress: from,
          status: "pdf_queued",
          rawBody: rawBodyPreview,
          errorMessage: null,
        });
      }

      // Parse PDFs asynchronously after responding to Resend
      const rowsToProcess = [...insertedPdfRows];
      if (rowsToProcess.length > 0) {
        after(async () => {
          const adminAsync = createAdminClient();

          const { data: userAccounts } = await adminAsync
            .rpc("get_accounts_with_masks", { p_user_id: userId });

          await Promise.all(
            rowsToProcess.map(async (row) => {
              try {
                const filenameInfo = parseStatementFilename(row.filename);
                const accountMatch = filenameInfo && userAccounts
                  ? matchAccountByLast4(
                      userAccounts as Array<{ id: string; mask: string | null; pdf_password: string | null }>,
                      filenameInfo.last4,
                    )
                  : null;

                const password = accountMatch?.pdfPassword ?? undefined;

                if (isPdfEncrypted(row.buffer) && !password) {
                  await adminAsync
                    .from("pending_email_statements")
                    .update({
                      status: "needs_password",
                      error_message: "PDF protegido con contraseña",
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", row.id)
                    .eq("user_id", userId);
                  return;
                }

                const parseResult = await parsePdfBuffer({
                  buffer: row.buffer,
                  filename: row.filename,
                  password,
                });

                if (parseResult.success) {
                  await adminAsync
                    .from("pending_email_statements")
                    .update({
                      status: "parsed",
                      parsed_data: parseResult.statements as unknown as Json,
                      parsed_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", row.id)
                    .eq("user_id", userId);
                } else {
                  await adminAsync
                    .from("pending_email_statements")
                    .update({
                      status: parseResult.needsPassword ? "needs_password" : "parse_failed",
                      error_message: parseResult.error,
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", row.id)
                    .eq("user_id", userId);
                }
              } catch {
                await adminAsync
                  .from("pending_email_statements")
                  .update({ status: "parse_failed", error_message: "Error inesperado al procesar", updated_at: new Date().toISOString() })
                  .eq("id", row.id)
                  .eq("user_id", userId);
              }
            }),
          );
        });
      }

      return NextResponse.json({ ok: true });
    }

    // No PDFs either — store as unrecognized
    console.log(`[email-ingest][${emailId}] No pattern matched, no PDF fallback — storing as unrecognized. Body preview: ${emailBody.slice(0, 200)}`);
    const { error: unrecognizedError } = await admin.from("unrecognized_emails").insert({
      user_id: userId,
      email_ingest_id: emailIngestId,
      from_address: from,
      subject: subject ?? null,
      text_body: emailText,
      html_body: emailHtml,
      status: "pending",
    });
    if (unrecognizedError) {
      console.error(`[email-ingest][${emailId}] Failed to insert unrecognized_email:`, unrecognizedError.message);
    }

    await insertLog({
      userId,
      emailIngestId,
      fromAddress: from,
      status: "parse_failed",
      rawBody: rawBodyPreview,
      errorMessage: "Email body did not match any known Bancolombia pattern",
    });
    revalidateTag("email-ingest", "zeta");
    return NextResponse.json({ ok: true });
  }

  // Clear Gmail verification URL now that real emails are flowing.
  // Write to _enc table directly — the view returns NULL for encrypted columns
  // with admin client, so the .not() filter would match nothing through the view.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from("email_ingest_addresses_enc")
    .update({ gmail_verification_url: null, gmail_verification_at: null })
    .eq("id", emailIngestId)
    .eq("user_id", userId)
    .not("gmail_verification_url", "is", null);

  // 8. Compute idempotency key
  const idempotencyKey = await computeIdempotencyKey({
    provider: "EMAIL",
    transactionDate: parsed.transaction_date,
    amount: parsed.amount,
    rawDescription: parsed.raw_line,
  });

  let suggestedAccountId = defaultAccountId ?? null;

  // Use RPC to decrypt masks — admin client has no JWT so zeta_decrypt() in the
  // accounts view returns NULL for encrypted columns (mask, debit_card_mask).
  const { data: candidateAccounts, error: accountLookupError } = await admin
    .rpc("get_accounts_with_masks", { p_user_id: userId });

  if (!accountLookupError && candidateAccounts) {
    suggestedAccountId = resolveSuggestedEmailAccountId({
      accounts: candidateAccounts,
      parsed,
      defaultAccountId,
    });
  } else if (accountLookupError) {
    console.warn("[email-ingest] account matching fallback:", accountLookupError.message);
  }

  // 9. Auto-import or queue. Auto import never decides a possible duplicate
  // on its own (#389): a collision with an existing transaction goes to the
  // queue flagged with the candidate and the user resolves it with the prompt.
  console.log(`[email-ingest][${emailId}] autoImport=${autoImport} suggestedAccountId=${suggestedAccountId}`);
  let conflictTransactionId: string | null = null;
  if (autoImport && suggestedAccountId) {
    try {
      const duplicate = await findEmailDuplicateCandidate({
        client: admin,
        userId,
        accountId: suggestedAccountId,
        parsed,
      });
      conflictTransactionId = duplicate?.candidate.id ?? null;
      if (conflictTransactionId) {
        console.log(`[email-ingest][${emailId}] Possible duplicate of ${conflictTransactionId} — queuing instead of auto-importing`);
      }
    } catch (error) {
      console.error(`[email-ingest][${emailId}] duplicate check failed:`, error);
    }
  }

  if (autoImport && suggestedAccountId && !conflictTransactionId) {
    const matchedAccount = candidateAccounts?.find((a) => a.id === suggestedAccountId);
    const currencyCode = matchedAccount?.currency_code ?? parsed.currency;
    const matchText = parsed.merchant ?? parsed.destination ?? parsed.raw_line ?? "";
    const destMatch = await matchTransactionToDestinatario(userId, matchText, admin);

    let categoryId: string | null = null;
    let destinatarioId: string | null = null;
    let categorizationSource: "USER_LEARNED" | "SYSTEM_DEFAULT" | undefined;

    if (destMatch) {
      destinatarioId = destMatch.destinatario_id;
      categoryId = destMatch.category_id;
      categorizationSource = categoryId ? "USER_LEARNED" : undefined;
    }

    if (!categoryId && parsed.merchant) {
      categoryId = autoCategorize(parsed.merchant)?.category_id ?? null;
      if (categoryId) categorizationSource = "SYSTEM_DEFAULT";
    }

    const { data: insertedTx, error: insertError } = await admin.from("transactions").insert({
      user_id: userId,
      account_id: suggestedAccountId,
      amount: parsed.amount,
      currency_code: currencyCode,
      direction: parsed.direction,
      transaction_date: parsed.transaction_date,
      // The alert's time of day is what tells two same-amount movements
      // apart later (issue #391); the manual approve path already stored it.
      transaction_time: normalizeEmailTime(parsed.transaction_time),
      raw_description: parsed.raw_line,
      clean_description: parsed.merchant ?? parsed.destination ?? parsed.raw_line,
      merchant_name: parsed.merchant,
      category_id: categoryId,
      destinatario_id: destinatarioId,
      idempotency_key: idempotencyKey,
      provider: "EMAIL",
      capture_method: "EMAIL_IMPORT",
      categorization_source: categorizationSource,
      status: "POSTED",
      ...flowClassColumns({
        direction: parsed.direction,
        accountType: matchedAccount?.account_type,
        description: parsed.merchant ?? parsed.destination ?? parsed.raw_line,
        sourcePattern: parsed.pattern_type,
      }),
    }).select("id").single();

    if (insertError) {
      if (insertError.code === "23505") {
        console.log(`[email-ingest][${emailId}] Duplicate transaction (idempotency conflict)`);
        await insertLog({
          userId,
          emailIngestId,
          fromAddress: from,
          status: "duplicate",
          rawBody: rawBodyPreview,
          errorMessage: "Duplicate transaction (idempotency key conflict)",
        });
      } else {
        console.error(`[email-ingest][${emailId}] Transaction insert failed: ${insertError.message} (code=${insertError.code})`);
        await insertLog({
          userId,
          emailIngestId,
          fromAddress: from,
          status: "parse_failed",
          rawBody: rawBodyPreview,
          errorMessage: `Insert error: ${insertError.message}`,
        });
      }
      return NextResponse.json({ ok: true });
    }

    console.log(`[email-ingest][${emailId}] Transaction auto-imported successfully`);

    // Link to pending recurring occurrence if applicable
    if (insertedTx) {
      await linkTransactionToOccurrence(
        suggestedAccountId,
        parsed.transaction_date,
        parsed.amount,
        parsed.direction,
        insertedTx.id,
        destinatarioId,
      );
    }

    // Update account balance
    if (matchedAccount) {
      const newBalance = applyAccountBalanceDelta({
        currentBalance: matchedAccount.current_balance ?? 0,
        accountType: matchedAccount.account_type,
        direction: parsed.direction,
        amount: parsed.amount,
      });
      const { error: balanceError } = await admin
        .from("accounts")
        .update({ current_balance: newBalance })
        .eq("id", suggestedAccountId)
        .eq("user_id", userId);
      if (balanceError) {
        console.error("[webhook] balance update failed:", balanceError);
      }
    }

    await insertLog({
      userId,
      emailIngestId,
      fromAddress: from,
      status: "imported",
      rawBody: rawBodyPreview,
      errorMessage: null,
    });

    // Invalidate caches so dashboard reflects the new transaction.
    // Route Handler context — must use `revalidateTag` (not `updateTag`)
    // so the user's next navigation sees fresh data. See
    // `revalidateFinancialViewsFromWebhook` docs for the why.
    revalidateFinancialViewsFromWebhook();
    revalidateTag("email-ingest", "zeta");

    return NextResponse.json({ ok: true });
  }

  // 10. Queue in pending_email_transactions (auto_import off, no suggested
  //     account, or possible duplicate)
  console.log(`[email-ingest][${emailId}] Queuing for manual review`);
  const { error: queueError } = await admin.from("pending_email_transactions").insert({
    user_id: userId,
    email_ingest_id: emailIngestId,
    idempotency_key: idempotencyKey,
    parsed_data: parsed as unknown as Json,
    raw_body: emailBody,
    status: "pending",
    suggested_account_id: suggestedAccountId,
    conflict_transaction_id: conflictTransactionId,
  });

  if (queueError) {
    if (queueError.code === "23505") {
      console.log(`[email-ingest][${emailId}] Duplicate pending transaction`);
      await insertLog({
        userId,
        emailIngestId,
        fromAddress: from,
        status: "duplicate",
        rawBody: rawBodyPreview,
        errorMessage: "Duplicate pending transaction (idempotency key conflict)",
      });
    } else {
      console.error(`[email-ingest][${emailId}] Queue insert failed: ${queueError.message}`);
      await insertLog({
        userId,
        emailIngestId,
        fromAddress: from,
        status: "parse_failed",
        rawBody: rawBodyPreview,
        errorMessage: `Queue error: ${queueError.message}`,
      });
    }
    return NextResponse.json({ ok: true });
  }

  // 11. Log as queued
  console.log(`[email-ingest][${emailId}] Queued successfully for manual review`);
  await insertLog({
    userId,
    emailIngestId,
    fromAddress: from,
    status: "queued",
    rawBody: rawBodyPreview,
    errorMessage: conflictTransactionId
      ? "Posible duplicado de una transacción existente — en cola para que decidas"
      : null,
  });

  revalidateTag("email-ingest", "zeta");
  revalidateTag("attention", "zeta");
  return NextResponse.json({ ok: true });
}
