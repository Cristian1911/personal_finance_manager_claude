"use server";

import { revalidateTag } from "next/cache";
import { nanoid } from "nanoid";
import { autoCategorize } from "@zeta/shared";
import { matchTransactionToDestinatario } from "./destinatarios";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import {
  parseBancolombiaEmail,
  type ParsedEmailTransaction,
} from "@/lib/parsers/bancolombia-email";
import { resolveSuggestedEmailAccountId } from "@/lib/email-ingest/account-matching";
import { accountMaskSuffixMatches } from "@/lib/utils/account-mask";
import { computeIdempotencyKey } from "@/lib/utils/idempotency";
import { applyAccountBalanceDelta } from "@/lib/utils/account-balance";
import type { ActionResult } from "@/types/actions";
import type { EmailIngestAddress, EmailIngestLog, PendingEmailTransaction, UnrecognizedEmail } from "@/types/domain";
import type { Json } from "@/types/database";

type AuthenticatedSupabase = Awaited<
  ReturnType<typeof getAuthenticatedClient>
>["supabase"];

type ReprocessResult = "imported" | "queued" | "duplicate";

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

function getStoredEmailBody(email: Pick<UnrecognizedEmail, "text_body" | "html_body">): string {
  if (email.text_body?.trim()) return email.text_body;
  if (email.html_body?.trim()) return stripHtml(email.html_body);
  return "";
}

async function persistParsedEmail(params: {
  supabase: AuthenticatedSupabase;
  userId: string;
  emailIngestId: string;
  defaultAccountId: string | null;
  autoImport: boolean;
  parsed: ParsedEmailTransaction;
  rawBody: string;
}): Promise<ActionResult<ReprocessResult>> {
  const { supabase, userId, emailIngestId, defaultAccountId, autoImport, parsed, rawBody } =
    params;

  const idempotencyKey = await computeIdempotencyKey({
    provider: "EMAIL",
    transactionDate: parsed.transaction_date,
    amount: parsed.amount,
    rawDescription: parsed.raw_line,
  });

  let suggestedAccountId = defaultAccountId ?? null;

  const { data: candidateAccounts, error: accountLookupError } = await supabase
    .from("accounts")
    .select("id, mask, debit_card_mask, account_type, currency_code")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (accountLookupError) {
    return { success: false, error: accountLookupError.message };
  }

  if (candidateAccounts) {
    suggestedAccountId = resolveSuggestedEmailAccountId({
      accounts: candidateAccounts,
      parsed,
      defaultAccountId,
    });
  }

  if (autoImport && suggestedAccountId) {
    const matchedAccount = candidateAccounts?.find((a) => a.id === suggestedAccountId);
    const currencyCode = matchedAccount?.currency_code ?? parsed.currency;
    const matchText = parsed.merchant ?? parsed.destination ?? parsed.raw_line ?? "";
    const destMatch = await matchTransactionToDestinatario(userId, matchText);

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

    const { error: insertError } = await supabase.from("transactions").insert({
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
    });

    if (insertError) {
      if (insertError.code === "23505") {
        revalidateTag("email-ingest", "zeta");
        return { success: true, data: "duplicate" };
      }
      return { success: false, error: insertError.message };
    }

    revalidateTag("email-ingest", "zeta");
    revalidateTag("dashboard:hero", "zeta");
    revalidateTag("dashboard:charts", "zeta");
    revalidateTag("dashboard:accounts", "zeta");
    revalidateTag("dashboard:cashflow", "zeta");
    revalidateTag("dashboard:budgets", "zeta");
    revalidateTag("accounts", "zeta");
    return { success: true, data: "imported" };
  }

  const { error: queueError } = await supabase.from("pending_email_transactions").insert({
    user_id: userId,
    email_ingest_id: emailIngestId,
    idempotency_key: idempotencyKey,
    parsed_data: parsed as unknown as Json,
    raw_body: rawBody,
    status: "pending",
    suggested_account_id: suggestedAccountId,
  });

  if (queueError) {
    if (queueError.code === "23505") {
      revalidateTag("email-ingest", "zeta");
      return { success: true, data: "duplicate" };
    }
    return { success: false, error: queueError.message };
  }

  revalidateTag("email-ingest", "zeta");
  return { success: true, data: "queued" };
}

// ─── Read actions ────────────────────────────────────────────────────────────

export async function getEmailIngestAddress(): Promise<
  ActionResult<EmailIngestAddress | null>
> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("email_ingest_addresses")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as EmailIngestAddress | null };
}

export async function getPendingEmailTransactions(): Promise<
  ActionResult<PendingEmailTransaction[]>
> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("pending_email_transactions")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as PendingEmailTransaction[] };
}

export async function getPendingEmailCount(): Promise<ActionResult<number>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { count, error } = await supabase
    .from("pending_email_transactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (error) return { success: false, error: error.message };
  return { success: true, data: count ?? 0 };
}

export async function getEmailIngestLogs(): Promise<ActionResult<EmailIngestLog[]>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("email_ingest_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as EmailIngestLog[] };
}

export async function getUnrecognizedEmails(): Promise<
  ActionResult<UnrecognizedEmail[]>
> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("unrecognized_emails")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return { success: false, error: error.message };
  return { success: true, data: (data ?? []) as UnrecognizedEmail[] };
}

export async function dismissUnrecognizedEmail(
  id: string
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("unrecognized_emails")
    .update({ status: "dismissed" })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}

export async function retryUnrecognizedEmail(
  id: string
): Promise<ActionResult<ReprocessResult>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: email, error: fetchError } = await supabase
    .from("unrecognized_emails")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError) return { success: false, error: fetchError.message };
  if (!email) return { success: false, error: "Correo no encontrado" };
  if (email.status !== "pending") {
    return { success: false, error: "Este correo ya fue procesado" };
  }

  const emailBody = getStoredEmailBody(email);
  if (!emailBody) {
    return { success: false, error: "El correo no tiene contenido utilizable" };
  }

  const parsed = parseBancolombiaEmail(emailBody);
  if (!parsed) {
    return {
      success: false,
      error: "El correo todavía no coincide con ningún patrón conocido",
    };
  }

  let ingestAddress: Pick<EmailIngestAddress, "id" | "account_id" | "auto_import"> | null =
    null;

  if (email.email_ingest_id) {
    const { data } = await supabase
      .from("email_ingest_addresses")
      .select("id, account_id, auto_import")
      .eq("id", email.email_ingest_id)
      .eq("user_id", user.id)
      .maybeSingle();
    ingestAddress = data as Pick<
      EmailIngestAddress,
      "id" | "account_id" | "auto_import"
    > | null;
  }

  if (!ingestAddress) {
    const { data } = await supabase
      .from("email_ingest_addresses")
      .select("id, account_id, auto_import")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    ingestAddress = data as Pick<
      EmailIngestAddress,
      "id" | "account_id" | "auto_import"
    > | null;
  }

  if (!ingestAddress) {
    return {
      success: false,
      error: "No se encontró una dirección de ingestión activa para reprocesar este correo",
    };
  }

  const persistResult = await persistParsedEmail({
    supabase,
    userId: user.id,
    emailIngestId: ingestAddress.id,
    defaultAccountId: ingestAddress.account_id,
    autoImport: ingestAddress.auto_import,
    parsed,
    rawBody: emailBody,
  });

  if (!persistResult.success) return persistResult;

  const { error: updateError } = await supabase
    .from("unrecognized_emails")
    .update({ status: "resolved" })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateError) return { success: false, error: updateError.message };

  revalidateTag("email-ingest", "zeta");
  return { success: true, data: persistResult.data };
}

// ─── Mutation actions ─────────────────────────────────────────────────────────

export async function generateIngestAddress(): Promise<ActionResult<EmailIngestAddress>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // Deactivate any existing active addresses first
  await supabase
    .from("email_ingest_addresses")
    .update({ is_active: false })
    .eq("user_id", user.id)
    .eq("is_active", true);

  const addressKey = `u_${nanoid(8)}`.toLowerCase();

  const { data, error } = await supabase
    .from("email_ingest_addresses")
    .insert({
      user_id: user.id,
      address_key: addressKey,
      is_active: true,
      auto_import: false,
    })
    .select("*")
    .single();

  if (error) return { success: false, error: error.message };

  revalidateTag("email-ingest", "zeta");
  return { success: true, data: data as EmailIngestAddress };
}

export async function updateIngestSettings(params: {
  accountId: string | null;
  autoImport: boolean;
  allowedSender?: string | null;
  pdfImportEnabled?: boolean;
}): Promise<ActionResult<EmailIngestAddress>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("email_ingest_addresses")
    .update({
      account_id: params.accountId,
      auto_import: params.autoImport,
      ...(params.allowedSender !== undefined && { allowed_sender: params.allowedSender || null }),
      ...(params.pdfImportEnabled !== undefined && { pdf_import_enabled: params.pdfImportEnabled }),
    })
    .eq("user_id", user.id)
    .eq("is_active", true)
    .select("*")
    .single();

  if (error) return { success: false, error: error.message };

  revalidateTag("email-ingest", "zeta");
  return { success: true, data: data as EmailIngestAddress };
}

export async function deactivateIngestAddress(): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("email_ingest_addresses")
    .update({ is_active: false })
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (error) return { success: false, error: error.message };

  revalidateTag("email-ingest", "zeta");
  return { success: true, data: null };
}

export async function clearGmailVerification(): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("email_ingest_addresses")
    .update({ gmail_verification_url: null, gmail_verification_at: null })
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (error) return { success: false, error: error.message };

  revalidateTag("email-ingest", "zeta");
  return { success: true, data: null };
}

export async function approveEmailTransaction(
  pendingId: string,
  overrideAccountId?: string
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // Fetch the pending transaction
  const { data: pending, error: fetchError } = await supabase
    .from("pending_email_transactions")
    .select("*")
    .eq("id", pendingId)
    .eq("user_id", user.id)
    .single();

  if (fetchError) return { success: false, error: fetchError.message };
  if (!pending) return { success: false, error: "Transacción pendiente no encontrada" };

  const parsed = pending.parsed_data as unknown as ParsedEmailTransaction;

  // Determine the target account: explicit override > suggested > ingest address default
  let accountId = overrideAccountId ?? pending.suggested_account_id;
  if (!accountId) {
    const { data: ingestAddress } = await supabase
      .from("email_ingest_addresses")
      .select("account_id")
      .eq("id", pending.email_ingest_id)
      .eq("user_id", user.id)
      .single();
    accountId = ingestAddress?.account_id ?? null;
  }

  if (!accountId) {
    return { success: false, error: "No se encontró una cuenta para esta transacción" };
  }

  // Get the account's currency
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("currency_code, account_type, debit_card_mask, current_balance")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .single();

  if (accountError) return { success: false, error: accountError.message };
  if (!account) return { success: false, error: "Cuenta no encontrada" };

  if (
    parsed.card_type === "T.Deb" &&
    parsed.card_last4 &&
    (account.account_type === "SAVINGS" || account.account_type === "CHECKING") &&
    !accountMaskSuffixMatches(account.debit_card_mask, parsed.card_last4)
  ) {
    const { error: learnMappingError } = await supabase
      .from("accounts")
      .update({ debit_card_mask: parsed.card_last4 })
      .eq("id", accountId)
      .eq("user_id", user.id);

    if (learnMappingError) {
      console.error(
        "[email-ingest] failed to learn debit card mapping:",
        learnMappingError.message
      );
    }
  }

  const merchantName = parsed.merchant ?? parsed.destination ?? null;
  const rawDescription = parsed.raw_line;
  const matchText = merchantName ?? rawDescription;

  const destMatch = await matchTransactionToDestinatario(user.id, matchText);

  let destinatarioId: string | null = null;
  let categoryId: string | null = null;
  let categorizationSource: "SYSTEM_DEFAULT" | "USER_LEARNED" | undefined;

  if (destMatch) {
    destinatarioId = destMatch.destinatario_id;
    categoryId = destMatch.category_id;
    categorizationSource = categoryId ? "USER_LEARNED" : undefined;
  }

  if (!categoryId && merchantName) {
    const categoryResult = autoCategorize(merchantName);
    categoryId = categoryResult?.category_id ?? null;
    if (categoryId) categorizationSource = "SYSTEM_DEFAULT";
  }

  // Compute idempotency key (reuse the one stored on the pending row when possible)
  const idempotencyKey =
    pending.idempotency_key ||
    (await computeIdempotencyKey({
      provider: "EMAIL_IMPORT",
      transactionDate: parsed.transaction_date,
      amount: parsed.amount,
      rawDescription: parsed.raw_line,
    }));

  const cleanDescription = merchantName ?? rawDescription;

  const { error: insertError } = await supabase.from("transactions").insert({
    user_id: user.id,
    account_id: accountId,
    amount: parsed.amount,
    currency_code: account.currency_code,
    direction: parsed.direction,
    transaction_date: parsed.transaction_date,
    raw_description: rawDescription,
    clean_description: cleanDescription,
    merchant_name: merchantName,
    idempotency_key: idempotencyKey,
    provider: "EMAIL",
    capture_method: "EMAIL_IMPORT",
    category_id: categoryId,
    categorization_source: categorizationSource,
    destinatario_id: destinatarioId,
    is_subscription: false,
    status: "POSTED",
  });

  if (insertError) {
    if (insertError.code === "23505") {
      // Duplicate — still mark as imported so it doesn't linger
      await supabase
        .from("pending_email_transactions")
        .update({ status: "imported" })
        .eq("id", pendingId)
        .eq("user_id", user.id);
      revalidateTag("email-ingest", "zeta");
      revalidateTag("dashboard:hero", "zeta");
      return { success: true, data: null };
    }
    return { success: false, error: insertError.message };
  }

  // Update account balance
  const newBalance = applyAccountBalanceDelta({
    currentBalance: account.current_balance ?? 0,
    accountType: account.account_type,
    direction: parsed.direction,
    amount: parsed.amount,
  });
  await supabase
    .from("accounts")
    .update({ current_balance: newBalance })
    .eq("id", accountId)
    .eq("user_id", user.id);

  // Mark pending transaction as imported
  const { error: updateError } = await supabase
    .from("pending_email_transactions")
    .update({ status: "imported" })
    .eq("id", pendingId)
    .eq("user_id", user.id);

  if (updateError) return { success: false, error: updateError.message };

  revalidateTag("email-ingest", "zeta");
  revalidateTag("dashboard:hero", "zeta");
  revalidateTag("dashboard:charts", "zeta");
  revalidateTag("dashboard:accounts", "zeta");
  revalidateTag("dashboard:cashflow", "zeta");
  revalidateTag("dashboard:budgets", "zeta");
  revalidateTag("accounts", "zeta");
  return { success: true, data: null };
}

export async function dismissEmailTransaction(
  pendingId: string
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("pending_email_transactions")
    .update({ status: "dismissed" })
    .eq("id", pendingId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidateTag("email-ingest", "zeta");
  return { success: true, data: null };
}

export async function bulkApproveEmailTransactions(
  pendingIds: string[]
): Promise<ActionResult<{ approved: number; errors: number }>> {
  let approved = 0;
  let errors = 0;

  for (const id of pendingIds) {
    const result = await approveEmailTransaction(id);
    if (result.success) {
      approved++;
    } else {
      errors++;
    }
  }

  return { success: true, data: { approved, errors } };
}
