import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBancolombiaEmail } from "@/lib/parsers/bancolombia-email";
import { computeIdempotencyKey } from "@/lib/utils/idempotency";
import { autoCategorize } from "@zeta/shared";
import type { Json } from "@/types/database";

// ── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_SENDER = "alertasynotificaciones@an.notificacionesbancolombia.com";
const RATE_LIMIT_PER_DAY = 100;

// ── Types ────────────────────────────────────────────────────────────────────

type ResendEmailPayload = {
  type: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
  };
};

type ResendEmailContent = {
  text: string | null;
  html: string | null;
};

type LogStatus =
  | "parsed"
  | "imported"
  | "queued"
  | "duplicate"
  | "parse_failed"
  | "sender_rejected"
  | "rate_limited";

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
  return { text: data.text ?? null, html: data.html ?? null };
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

async function insertLog(params: {
  userId: string | null;
  emailIngestId: string | null;
  fromAddress: string;
  status: LogStatus;
  rawBody: string | null;
  errorMessage: string | null;
}) {
  const admin = createAdminClient();
  await admin.from("email_ingest_logs").insert({
    user_id: params.userId,
    email_ingest_id: params.emailIngestId,
    from_address: params.fromAddress,
    status: params.status,
    raw_body: params.rawBody ? params.rawBody.slice(0, 500) : null,
    error_message: params.errorMessage,
  });
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Read body once (needed for both signature verification and JSON parsing)
  const rawBody = await request.text();

  // 1. Verify Resend webhook signature
  const isValid = await verifyResendSignature(request, rawBody);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 2. Parse JSON payload
  let payload: ResendEmailPayload;
  try {
    payload = JSON.parse(rawBody) as ResendEmailPayload;
  } catch {
    return NextResponse.json({ ok: true });
  }

  // Only handle email.received events
  if (payload.type !== "email.received") {
    return NextResponse.json({ ok: true });
  }

  const { from, to, email_id: emailId } = payload.data;

  // Webhook payload has metadata only — fetch full email content from Resend API
  const emailContent = await fetchEmailContent(emailId);
  const emailText = emailContent?.text ?? null;
  const emailHtml = emailContent?.html ?? null;
  // Prefer plain text; fall back to stripped HTML
  const emailBody = emailText || (emailHtml ? stripHtml(emailHtml) : "");
  const rawBodyPreview = emailBody?.slice(0, 500) ?? null;

  // 3. Extract address key from recipient (e.g. "u_abc123@domain.com" → "u_abc123")
  const recipientEmail = to?.[0] ?? "";
  const addressKey = recipientEmail.split("@")[0] ?? "";

  if (!addressKey) {
    await insertLog({
      userId: null,
      emailIngestId: null,
      fromAddress: from,
      status: "parse_failed",
      rawBody: rawBodyPreview,
      errorMessage: "Could not extract address_key from recipient",
    });
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient();

  // 4. Look up email_ingest_addresses by address_key + is_active = true
  const { data: ingestAddress } = await admin
    .from("email_ingest_addresses")
    .select("id, user_id, account_id, auto_import, allowed_sender")
    .eq("address_key", addressKey)
    .eq("is_active", true)
    .single();

  if (!ingestAddress) {
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

  const { id: emailIngestId, user_id: userId, account_id: accountId, auto_import: autoImport, allowed_sender: allowedSender } = ingestAddress;

  // 5. Detect Gmail forwarding verification emails
  const fromLower = from.toLowerCase();
  if (fromLower.includes("forwarding-noreply@google.com")) {
    const emailContent = emailBody || emailHtml || "";
    const verifyMatch = emailContent.match(
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
  const isBankSender = fromLower.includes(ALLOWED_SENDER);
  const isAllowedSender = allowedSender && fromLower.includes(allowedSender.toLowerCase());
  if (!isBankSender && !isAllowedSender) {
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

  // 7. Rate limit: max 100 emails/day/user
  const withinLimit = await checkRateLimit(userId);
  if (!withinLimit) {
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

  // 7. Parse email body
  const parsed = parseBancolombiaEmail(emailBody);

  if (!parsed) {
    // Store full email for parser improvement review
    await admin.from("unrecognized_emails").insert({
      user_id: userId,
      email_ingest_id: emailIngestId,
      from_address: from,
      subject: payload.data.subject ?? null,
      text_body: emailText,
      html_body: emailHtml,
      status: "pending",
    });

    await insertLog({
      userId,
      emailIngestId,
      fromAddress: from,
      status: "parse_failed",
      rawBody: rawBodyPreview,
      errorMessage: "Email body did not match any known Bancolombia pattern",
    });
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

  // 9. Auto-import or queue
  if (autoImport && accountId) {
    // Get account currency
    const { data: account } = await admin
      .from("accounts")
      .select("currency_code")
      .eq("id", accountId)
      .eq("user_id", userId)
      .single();

    const currencyCode = account?.currency_code ?? parsed.currency;
    const categoryResult = parsed.merchant ? autoCategorize(parsed.merchant) : null;
    const categoryId = categoryResult?.category_id ?? null;

    const { error: insertError } = await admin.from("transactions").insert({
      user_id: userId,
      account_id: accountId,
      amount: parsed.amount,
      currency_code: currencyCode,
      direction: parsed.direction,
      transaction_date: parsed.transaction_date,
      raw_description: parsed.raw_line,
      clean_description: parsed.merchant ?? parsed.destination ?? parsed.raw_line,
      merchant_name: parsed.merchant,
      category_id: categoryId,
      idempotency_key: idempotencyKey,
      provider: "EMAIL",
      capture_method: "EMAIL_IMPORT",
      is_subscription: false,
      categorization_source: categoryId ? "SYSTEM_DEFAULT" : undefined,
      status: "POSTED",
    });

    if (insertError) {
      if (insertError.code === "23505") {
        await insertLog({
          userId,
          emailIngestId,
          fromAddress: from,
          status: "duplicate",
          rawBody: rawBodyPreview,
          errorMessage: "Duplicate transaction (idempotency key conflict)",
        });
      } else {
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

    await insertLog({
      userId,
      emailIngestId,
      fromAddress: from,
      status: "imported",
      rawBody: rawBodyPreview,
      errorMessage: null,
    });
    return NextResponse.json({ ok: true });
  }

  // 10. Queue in pending_email_transactions
  const { error: queueError } = await admin.from("pending_email_transactions").insert({
    user_id: userId,
    email_ingest_id: emailIngestId,
    idempotency_key: idempotencyKey,
    parsed_data: parsed as unknown as Json,
    raw_body: emailBody,
    status: "pending",
    suggested_account_id: accountId ?? null,
  });

  if (queueError) {
    if (queueError.code === "23505") {
      await insertLog({
        userId,
        emailIngestId,
        fromAddress: from,
        status: "duplicate",
        rawBody: rawBodyPreview,
        errorMessage: "Duplicate pending transaction (idempotency key conflict)",
      });
    } else {
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
  await insertLog({
    userId,
    emailIngestId,
    fromAddress: from,
    status: "queued",
    rawBody: rawBodyPreview,
    errorMessage: null,
  });

  return NextResponse.json({ ok: true });
}
