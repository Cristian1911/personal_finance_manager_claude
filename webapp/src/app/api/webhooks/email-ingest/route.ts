import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBancolombiaEmail } from "@/lib/parsers/bancolombia-email";
import { resolveSuggestedEmailAccountId } from "@/lib/email-ingest/account-matching";
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
import { revalidateFinancialViews } from "@/lib/cache/revalidation";
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

async function fetchEmailContent(emailId: string): Promise<ResendEmailContent | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[email-ingest] RESEND_API_KEY not set — cannot fetch email content");
    return null;
  }

  const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    console.error(`[email-ingest] Resend API error: ${res.status} ${res.statusText}`);
    return null;
  }

  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attachments: ResendAttachment[] = (data.attachments ?? []).map((a: any) => ({
    filename: a.filename ?? "attachment.pdf",
    content_type: a.content_type ?? a.contentType ?? "",
    content: a.content ?? "",
  }));
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
  return parts.join("\n").slice(0, 500);
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
    raw_body: params.rawBody ? params.rawBody.slice(0, 500) : null,
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

  // 4. Look up email_ingest_addresses by address_key + is_active = true
  //    Use case-insensitive match: Resend may lowercase the recipient address
  //    on direct inbound delivery while the stored key retains mixed case.
  const { data: ingestAddress } = await admin
    .from("email_ingest_addresses")
    .select("id, user_id, account_id, auto_import, allowed_sender, pdf_import_enabled")
    .filter("address_key", "ilike", addressKey.replace(/%/g, "\\%").replace(/_/g, "\\_"))
    .eq("is_active", true)
    .single();

  if (!ingestAddress) {
    console.warn(`[email-ingest][${emailId}] No active ingest address for key="${addressKey}"`);
    await insertLog({
      userId: null,
      emailIngestId: null,
      fromAddress: from,
      status: "parse_failed",
      rawBody: rawBodyPreview,
      errorMessage: `No active ingest address found for key: ${addressKey}`,
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
  } = ingestAddress;

  // 5. Detect Gmail forwarding verification emails
  const fromLower = from.toLowerCase();
  if (fromLower.includes("forwarding-noreply@google.com")) {
    const verificationContent = emailBody || emailHtml || "";
    const verifyMatch = verificationContent.match(
      /https:\/\/mail\.google\.com\/mail\/vf-[^\s"<>]+/
    );
    if (verifyMatch) {
      await admin
        .from("email_ingest_addresses")
        .update({
          gmail_verification_url: verifyMatch[0],
          gmail_verification_at: new Date().toISOString(),
        })
        .eq("id", emailIngestId)
        .eq("user_id", userId);
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

  // 6. Validate sender — accept bank notifications or the user's personal forwarding email
  const isBankSender = ALLOWED_SENDERS.some((s) => fromLower.includes(s));
  const isAllowedSender = allowedSender && fromLower.includes(allowedSender.toLowerCase());
  if (!isBankSender && !isAllowedSender) {
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

  console.log(`[email-ingest][${emailId}] Sender OK (bank=${isBankSender}, allowed=${!!isAllowedSender}), user=${userId}`);

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
      const insertedPdfRows: Array<{ id: string; buffer: ArrayBuffer; filename: string }> = [];

      for (const attachment of pdfAttachments) {
        const filename = attachment.filename || "attachment.pdf";
        const bytes = Buffer.from(attachment.content, "base64");
        const contentHash = await computePdfHash(bytes.buffer);

        // Check idempotency: skip if we already have this PDF
        const { data: existing } = await admin
          .from("pending_email_statements")
          .select("id")
          .eq("user_id", userId)
          .eq("idempotency_hash", contentHash)
          .not("status", "in", "(dismissed)")
          .maybeSingle();

        if (existing) {
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

        // Store PDF in Supabase Storage
        const timestamp = Date.now();
        const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `${userId}/${timestamp}-${safeName}`;

        const { error: uploadError } = await admin.storage
          .from("email-pdfs")
          .upload(storagePath, bytes.buffer, {
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

        insertedPdfRows.push({ id: inserted.id, buffer: bytes.buffer, filename });

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

  // Clear Gmail verification URL now that real emails are flowing
  await admin
    .from("email_ingest_addresses")
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

  // 9. Auto-import or queue
  console.log(`[email-ingest][${emailId}] autoImport=${autoImport} suggestedAccountId=${suggestedAccountId}`);
  if (autoImport && suggestedAccountId) {
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
      raw_description: parsed.raw_line,
      clean_description: parsed.merchant ?? parsed.destination ?? parsed.raw_line,
      merchant_name: parsed.merchant,
      category_id: categoryId,
      destinatario_id: destinatarioId,
      idempotency_key: idempotencyKey,
      provider: "EMAIL",
      capture_method: "EMAIL_IMPORT",
      is_subscription: false,
      categorization_source: categorizationSource,
      status: "POSTED",
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

    // Invalidate caches so dashboard reflects the new transaction
    revalidateFinancialViews();
    revalidateTag("email-ingest", "zeta");

    return NextResponse.json({ ok: true });
  }

  // 10. Queue in pending_email_transactions (auto_import off or no suggested account)
  console.log(`[email-ingest][${emailId}] Queuing for manual review`);
  const { error: queueError } = await admin.from("pending_email_transactions").insert({
    user_id: userId,
    email_ingest_id: emailIngestId,
    idempotency_key: idempotencyKey,
    parsed_data: parsed as unknown as Json,
    raw_body: emailBody,
    status: "pending",
    suggested_account_id: suggestedAccountId,
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
    errorMessage: null,
  });

  revalidateTag("email-ingest", "zeta");
  return NextResponse.json({ ok: true });
}
