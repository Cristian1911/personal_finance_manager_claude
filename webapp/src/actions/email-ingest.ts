"use server";

import { cacheTag, cacheLife, updateTag } from "next/cache";
import { createCachedClient } from "@/lib/supabase/cached";
import { revalidateFinancialViews } from "@/lib/cache/revalidation";
import { nanoid } from "nanoid";
import {
  autoCategorize,
  findReconciliationCandidates,
  mergeTransactionMetadata,
  type ReconciliationCandidate,
} from "@zeta/shared";
import { toISODateString } from "@/lib/utils/date";
import { matchTransactionToDestinatario } from "./destinatarios";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { linkTransactionToOccurrence } from "@/actions/occurrences";
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
    .select("id, mask, debit_card_mask, account_type, currency_code, current_balance")
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
    const destMatch = await matchTransactionToDestinatario(userId, matchText, supabase);

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

    const { data: insertedTxAuto, error: insertError } = await supabase.from("transactions").insert({
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
      categorization_source: categorizationSource,
      status: "POSTED",
    }).select("id").single();

    if (insertError) {
      if (insertError.code === "23505") {
        updateTag("email-ingest");
        return { success: true, data: "duplicate" };
      }
      return { success: false, error: insertError.message };
    }

    if (insertedTxAuto) {
      await linkTransactionToOccurrence(
        suggestedAccountId, parsed.transaction_date,
        parsed.amount, parsed.direction, insertedTxAuto.id,
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
      const { error: balanceError } = await supabase
        .from("accounts")
        .update({ current_balance: newBalance })
        .eq("id", suggestedAccountId)
        .eq("user_id", userId);
      if (balanceError) {
        console.error("[persistParsedEmail] balance update failed:", balanceError);
      }
    }

    revalidateFinancialViews();
    updateTag("email-ingest");
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
      updateTag("email-ingest");
      return { success: true, data: "duplicate" };
    }
    return { success: false, error: queueError.message };
  }

  updateTag("email-ingest");
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

async function getPendingEmailTransactionsCached(
  userId: string,
  accessToken: string,
): Promise<PendingEmailTransaction[]> {
  "use cache";
  cacheTag("email-ingest");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const { data, error } = await supabase
    .from("pending_email_transactions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []) as PendingEmailTransaction[];
}

export async function getPendingEmailTransactions(): Promise<
  ActionResult<PendingEmailTransaction[]>
> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };

  try {
    const data = await getPendingEmailTransactionsCached(user.id, accessToken);
    return { success: true, data };
  } catch (error) {
    console.error("Error fetching pending email transactions:", error);
    return { success: false, error: "Error al obtener transacciones pendientes" };
  }
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
    .select("id, status, from_address, error_message, raw_body, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

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

  updateTag("email-ingest");
  return { success: true, data: persistResult.data };
}

export async function retryEmailIngestLog(
  logId: string
): Promise<ActionResult<ReprocessResult>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: log, error: fetchError } = await supabase
    .from("email_ingest_logs")
    .select("id, user_id, email_ingest_id, raw_body, status")
    .eq("id", logId)
    .eq("user_id", user.id)
    .single();

  if (fetchError) return { success: false, error: fetchError.message };
  if (!log) return { success: false, error: "Log no encontrado" };

  const retryableStatuses = ["sender_rejected", "parse_failed", "rate_limited"];
  if (!retryableStatuses.includes(log.status)) {
    return { success: false, error: "Este correo no se puede reintentar" };
  }

  // Extract body from raw_body — strip the [Subject: ...] prefix if present
  let emailBody = log.raw_body ?? "";
  const subjectPrefixMatch = emailBody.match(/^\[Subject: [^\]]*\]\n?/);
  if (subjectPrefixMatch) {
    emailBody = emailBody.slice(subjectPrefixMatch[0].length);
  }

  if (!emailBody.trim()) {
    return { success: false, error: "El log no tiene contenido de correo para reprocesar" };
  }

  const parsed = parseBancolombiaEmail(emailBody);
  if (!parsed) {
    return {
      success: false,
      error: "El contenido no coincide con ningún patrón conocido",
    };
  }

  // Find the ingest address for this user
  let ingestAddress: Pick<EmailIngestAddress, "id" | "account_id" | "auto_import"> | null = null;

  if (log.email_ingest_id) {
    const { data } = await supabase
      .from("email_ingest_addresses")
      .select("id, account_id, auto_import")
      .eq("id", log.email_ingest_id)
      .eq("user_id", user.id)
      .maybeSingle();
    ingestAddress = data as Pick<EmailIngestAddress, "id" | "account_id" | "auto_import"> | null;
  }

  if (!ingestAddress) {
    const { data } = await supabase
      .from("email_ingest_addresses")
      .select("id, account_id, auto_import")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    ingestAddress = data as Pick<EmailIngestAddress, "id" | "account_id" | "auto_import"> | null;
  }

  if (!ingestAddress) {
    return {
      success: false,
      error: "No se encontró una dirección de ingestión activa",
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

  // Update the log status so it no longer shows as failed on reload
  const statusMap: Record<string, string> = {
    imported: "imported",
    queued: "queued",
    duplicate: "duplicate",
  };
  const newStatus = statusMap[persistResult.data] ?? "imported";
  const { error: updateError } = await supabase
    .from("email_ingest_logs")
    .update({ status: newStatus, error_message: null })
    .eq("id", logId)
    .eq("user_id", user.id);
  if (updateError) {
    console.error("[retryEmailIngestLog] log status update failed:", updateError);
  }

  updateTag("email-ingest");
  return { success: true, data: persistResult.data };
}

export async function dismissEmailIngestLog(
  logId: string
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("email_ingest_logs")
    .update({ status: "dismissed" })
    .eq("id", logId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  updateTag("email-ingest");
  return { success: true, data: null };
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

  updateTag("email-ingest");
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

  updateTag("email-ingest");
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

  updateTag("email-ingest");
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

  updateTag("email-ingest");
  return { success: true, data: null };
}

export async function approveEmailTransaction(
  pendingId: string,
  overrideAccountId?: string,
  reconcileWithTransactionId?: string
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
      provider: "EMAIL",
      transactionDate: parsed.transaction_date,
      amount: parsed.amount,
      rawDescription: parsed.raw_line,
    }));

  const cleanDescription = merchantName ?? rawDescription;

  const { data: insertedTx, error: insertError } = await supabase
    .from("transactions")
    .insert({
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
      status: "POSTED",
    })
    .select("id, category_id, categorization_source, notes")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      // Duplicate — still mark as imported so it doesn't linger
      await supabase
        .from("pending_email_transactions")
        .update({ status: "imported" })
        .eq("id", pendingId)
        .eq("user_id", user.id);
      updateTag("email-ingest");
      updateTag("dashboard:hero");
      return { success: true, data: null };
    }
    return { success: false, error: insertError.message };
  }

  if (insertedTx) {
    await linkTransactionToOccurrence(
      accountId, parsed.transaction_date,
      parsed.amount, parsed.direction, insertedTx.id,
    );
  }

  // Reconcile with existing manual transaction if requested
  if (reconcileWithTransactionId && insertedTx) {
    const { data: manualTx } = await supabase
      .from("transactions")
      .select(
        "id, category_id, categorization_source, notes, reconciled_into_transaction_id, capture_method"
      )
      .eq("id", reconcileWithTransactionId)
      .eq("user_id", user.id)
      .is("reconciled_into_transaction_id", null)
      .maybeSingle();

    if (manualTx) {
      const merged = mergeTransactionMetadata(
        manualTx as ReconciliationCandidate,
        {
          category_id: insertedTx.category_id,
          categorization_source: insertedTx.categorization_source,
          notes: insertedTx.notes,
          capture_method: "EMAIL_IMPORT",
        }
      );

      await supabase
        .from("transactions")
        .update({
          category_id: merged.category_id ?? null,
          notes: merged.notes ?? null,
          capture_method: merged.capture_method,
        })
        .eq("user_id", user.id)
        .eq("id", insertedTx.id);

      await supabase
        .from("transactions")
        .update({ reconciled_into_transaction_id: insertedTx.id })
        .eq("user_id", user.id)
        .eq("id", manualTx.id);
    }
  }

  // Update account balance — skip when reconciling (manual tx already counted it)
  if (!reconcileWithTransactionId) {
    const newBalance = applyAccountBalanceDelta({
      currentBalance: account.current_balance ?? 0,
      accountType: account.account_type,
      direction: parsed.direction,
      amount: parsed.amount,
    });
    const { error: balanceError } = await supabase
      .from("accounts")
      .update({ current_balance: newBalance })
      .eq("id", accountId)
      .eq("user_id", user.id);
    if (balanceError) {
      console.error("[approveEmailTransaction] balance update failed:", balanceError);
    }
  }

  // Mark pending transaction as imported
  const { error: updateError } = await supabase
    .from("pending_email_transactions")
    .update({ status: "imported" })
    .eq("id", pendingId)
    .eq("user_id", user.id);

  if (updateError) return { success: false, error: updateError.message };

  revalidateFinancialViews();
  updateTag("email-ingest");
  return { success: true, data: null };
}

export type ReconciliationCandidatePreview = {
  id: string;
  raw_description: string | null;
  merchant_name: string | null;
  transaction_date: string;
  amount: number;
  direction: string;
  category_id: string | null;
  score: number;
};

export async function checkEmailReconciliation(
  pendingId: string,
  overrideAccountId?: string
): Promise<
  ActionResult<{
    candidate: ReconciliationCandidatePreview;
    decision: "AUTO_MERGE" | "REVIEW";
  } | null>
> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: pending, error: fetchError } = await supabase
    .from("pending_email_transactions")
    .select("*")
    .eq("id", pendingId)
    .eq("user_id", user.id)
    .single();

  if (fetchError) return { success: false, error: fetchError.message };
  if (!pending) return { success: false, error: "No encontrada" };

  const parsed = pending.parsed_data as unknown as ParsedEmailTransaction;

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

  if (!accountId) return { success: true, data: null };

  // ±3 days to match scoring tolerance in scoreReconciliationCandidate
  const txDate = new Date(parsed.transaction_date);
  const fromDate = new Date(txDate);
  fromDate.setDate(fromDate.getDate() - 3);
  const toDate = new Date(txDate);
  toDate.setDate(toDate.getDate() + 3);
  const from = toISODateString(fromDate);
  const to = toISODateString(toDate);

  // Fetch existing transactions that could be duplicates (any capture method)
  const { data: candidates, error: candError } = await supabase
    .from("transactions")
    .select(
      "id, user_id, account_id, amount, direction, transaction_date, raw_description, merchant_name, clean_description, category_id, categorization_source, notes, reconciled_into_transaction_id, capture_method"
    )
    .eq("account_id", accountId)
    .eq("user_id", user.id)
    .gte("transaction_date", from)
    .lte("transaction_date", to)
    .is("reconciled_into_transaction_id", null);

  if (candError) return { success: false, error: candError.message };
  if (!candidates || candidates.length === 0) return { success: true, data: null };

  const importTx = {
    account_id: accountId,
    amount: parsed.amount,
    direction: parsed.direction,
    transaction_date: parsed.transaction_date,
    raw_description: parsed.raw_line,
  };

  const result = findReconciliationCandidates(
    importTx,
    candidates as ReconciliationCandidate[]
  );

  if (!result.bestMatch || result.bestMatch.decision === "NO_MATCH") {
    return { success: true, data: null };
  }

  const matched = candidates.find((c) => c.id === result.bestMatch!.candidateId);
  if (!matched) return { success: true, data: null };

  return {
    success: true,
    data: {
      candidate: {
        id: matched.id,
        raw_description: matched.raw_description,
        merchant_name: matched.merchant_name,
        transaction_date: matched.transaction_date,
        amount: matched.amount,
        direction: matched.direction,
        category_id: matched.category_id,
        score: result.bestMatch.score,
      },
      decision: result.bestMatch.decision as "AUTO_MERGE" | "REVIEW",
    },
  };
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

  updateTag("email-ingest");
  updateTag("attention");
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

// ── Allowed Senders CRUD ──────────────────────────────────────────────────────

export type AllowedSender = {
  id: string;
  sender_email: string;
  label: string | null;
  created_at: string;
};

export async function getAllowedSenders(): Promise<AllowedSender[]> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return [];

  const { data } = await supabase
    .from("email_ingest_allowed_senders")
    .select("id, sender_email, label, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return (data ?? []) as AllowedSender[];
}

export async function addAllowedSender(
  senderEmail: string,
  label?: string | null
): Promise<ActionResult<AllowedSender>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const email = senderEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { success: false, error: "Dirección de correo inválida" };
  }

  const { data, error } = await supabase
    .from("email_ingest_allowed_senders")
    .insert({
      user_id: user.id,
      sender_email: email,
      label: label?.trim() || null,
    })
    .select("id, sender_email, label, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Este remitente ya está registrado" };
    }
    return { success: false, error: error.message };
  }

  updateTag("email-ingest");
  return { success: true, data: data as AllowedSender };
}

export async function removeAllowedSender(id: string): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("email_ingest_allowed_senders")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  updateTag("email-ingest");
  return { success: true, data: null };
}
