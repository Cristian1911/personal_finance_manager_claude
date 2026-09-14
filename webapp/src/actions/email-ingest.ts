"use server";

import { cacheTag, cacheLife, updateTag } from "next/cache";
import { createCachedClient } from "@/lib/supabase/cached";
import { attachTagsToTransactions } from "@/lib/tags/attach-transaction-tags";
import { flowClassColumns } from "@/lib/utils/flow-class-columns";
import { revalidateFinancialViews } from "@/lib/cache/revalidation";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  autoCategorize,
  extractPattern,
  mergeTransactionMetadata,
  type ReconciliationCandidate,
} from "@zeta/shared";
import { uuidStr } from "@/lib/validators/shared";
import { matchTransactionToDestinatario } from "./destinatarios";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { linkTransactionToOccurrence } from "@/actions/occurrences";
import {
  parseBancolombiaEmail,
  type ParsedEmailTransaction,
} from "@/lib/parsers/bancolombia-email";
import { resolveEmailTransactionCurrency } from "@/lib/email-ingest/currency";
import {
  accountCarriesEmailProduct,
  accountFitsEmailProduct,
  describeEmailProduct,
  emailProductKind,
  emailProductMaskToLearn,
  resolveSuggestedEmailAccountId,
} from "@/lib/email-ingest/account-matching";
import {
  findEmailDuplicateCandidate,
  findTransactionByIdempotencyKey,
} from "@/lib/email-ingest/duplicate-check";
import { normalizeEmailTime } from "@/lib/email-ingest/time";
import {
  accountMaskSuffixMatches,
  normalizeAccountMaskSuffix,
} from "@/lib/utils/account-mask";
import { computeIdempotencyKey } from "@/lib/utils/idempotency";
import { carryRecurringLinkToSurvivor } from "@/lib/recurring/carry-link";
import { applyAccountBalanceDelta } from "@/lib/utils/account-balance";
import { accountSchema } from "@/lib/validators/account";
import type { ActionResult } from "@/types/actions";
import type {
  Account,
  EmailIngestAddress,
  EmailIngestLog,
  PendingEmailTransaction,
  UnrecognizedEmail,
} from "@/types/domain";
import type { Json, Tables } from "@/types/database";

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

  // Same email already imported (redelivery, retry of a processed log): a
  // clean skip, before any fuzzy duplicate scoring gets a chance to queue it.
  try {
    const existingId = await findTransactionByIdempotencyKey({
      client: supabase,
      userId,
      idempotencyKey,
    });
    if (existingId) {
      updateTag("email-ingest");
      return { success: true, data: "duplicate" };
    }
  } catch (error) {
    console.error("[persistParsedEmail] idempotency lookup failed:", error);
  }

  // Only an unmasked alert may fall back to the ingest default; a masked one
  // with no matching account is a product the user hasn't registered.
  let suggestedAccountId = normalizeAccountMaskSuffix(parsed.card_last4)
    ? null
    : defaultAccountId ?? null;

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

  // Auto import never decides a possible duplicate on its own (#389): when
  // the alert collides with an existing transaction it goes to the queue
  // flagged with the candidate, and the user resolves it with the prompt.
  let conflictTransactionId: string | null = null;
  if (autoImport && suggestedAccountId) {
    try {
      const duplicate = await findEmailDuplicateCandidate({
        client: supabase,
        userId,
        accountId: suggestedAccountId,
        parsed,
      });
      conflictTransactionId = duplicate?.candidate.id ?? null;
    } catch (error) {
      console.error("[persistParsedEmail] duplicate check failed:", error);
    }
  }

  if (autoImport && suggestedAccountId && !conflictTransactionId) {
    const matchedAccount = candidateAccounts?.find((a) => a.id === suggestedAccountId);
    const currencyCode = resolveEmailTransactionCurrency(parsed, matchedAccount?.currency_code);
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
      // pattern_type has been parsed and thrown away on every email since this
      // path existed. It is the strongest signal available here — `nomina`
      // settles INCOME outright, `avance` settles DEBT_DRAWDOWN — and it is
      // persisted alongside the verdict so a rules bump can re-derive from it.
      ...flowClassColumns({
        direction: parsed.direction,
        accountType: matchedAccount?.account_type,
        description: parsed.merchant ?? parsed.destination ?? parsed.raw_line,
        sourcePattern: parsed.pattern_type,
      }),
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
    conflict_transaction_id: conflictTransactionId,
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

async function getEmailIngestAddressCached(
  userId: string,
  accessToken: string,
): Promise<EmailIngestAddress | null> {
  "use cache";
  cacheTag("email-ingest");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const { data, error } = await supabase
    .from("email_ingest_addresses")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data as EmailIngestAddress | null;
}

export async function getEmailIngestAddress(): Promise<
  ActionResult<EmailIngestAddress | null>
> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };

  try {
    const data = await getEmailIngestAddressCached(user.id, accessToken);
    return { success: true, data };
  } catch (error) {
    console.error("Error loading email ingest address:", error);
    return { success: false, error: "Error al cargar configuración de correo" };
  }
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

  // Fetch the pending transaction — only rows still in the queue. A row
  // already imported or dismissed must not be replayed (bulk approve used to
  // resubmit processed ids and ride the duplicate branch).
  const { data: pending, error: fetchError } = await supabase
    .from("pending_email_transactions")
    .select("*")
    .eq("id", pendingId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (fetchError) return { success: false, error: fetchError.message };
  if (!pending) return { success: false, error: "Transacción pendiente no encontrada" };

  const parsed = pending.parsed_data as unknown as ParsedEmailTransaction;

  // Determine the target account: explicit override > suggested > ingest address default
  let accountId = overrideAccountId ?? pending.suggested_account_id;
  if (!accountId) {
    accountId = await resolveIngestDefaultAccountId(supabase, user.id, pending, parsed);
  }

  if (!accountId) {
    return { success: false, error: "No se encontró una cuenta para esta transacción" };
  }

  // Get the account's currency
  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id, currency_code, account_type, mask, debit_card_mask, current_balance")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .single();

  if (accountError) return { success: false, error: accountError.message };
  if (!account) return { success: false, error: "Cuenta no encontrada" };

  // Importing into an account teaches it the product the alert came from, so
  // the next alert from the same card matches without asking again.
  const learned = emailProductMaskToLearn({
    account,
    cardType: parsed.card_type,
    last4: parsed.card_last4,
    explicit: false,
  });
  if (learned) {
    const { error: learnMappingError } = await supabase
      .from("accounts")
      .update({ [learned.column]: learned.value })
      .eq("id", accountId)
      .eq("user_id", user.id);

    if (learnMappingError) {
      console.error(
        "[email-ingest] failed to learn product mapping:",
        learnMappingError.message
      );
    } else {
      updateTag("accounts");
    }
  }

  const merchantName = parsed.merchant ?? parsed.destination ?? null;
  const rawDescription = parsed.raw_line;
  const matchText = merchantName ?? rawDescription;

  const destMatch = await matchTransactionToDestinatario(user.id, matchText);

  let destinatarioId: string | null = null;
  let categoryId: string | null = null;
  let categorizationSource: "SYSTEM_DEFAULT" | "USER_LEARNED" | "USER_OVERRIDE" | undefined;

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

  // Enrichment the user set while the row sat in the queue beats every
  // automatic guess — it's the same authority as categorizing the
  // transaction by hand afterwards, just earlier.
  const userCategoryId = pending.category_id ?? null;
  if (userCategoryId) {
    categoryId = userCategoryId;
    categorizationSource = "USER_OVERRIDE";
  }
  const userNotes = pending.notes?.trim() ? pending.notes.trim() : null;
  const userTagIds = [...new Set(pending.tag_ids ?? [])];

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
      currency_code: resolveEmailTransactionCurrency(parsed, account.currency_code),
      direction: parsed.direction,
      transaction_date: parsed.transaction_date,
      transaction_time: normalizeEmailTime(parsed.transaction_time),
      raw_description: rawDescription,
      clean_description: cleanDescription,
      merchant_name: merchantName,
      idempotency_key: idempotencyKey,
      provider: "EMAIL",
      capture_method: "EMAIL_IMPORT",
      category_id: categoryId,
      categorization_source: categorizationSource,
      destinatario_id: destinatarioId,
      notes: userNotes,
      status: "POSTED",
      ...flowClassColumns({
        direction: parsed.direction,
        accountType: account.account_type,
        description: cleanDescription,
        sourcePattern: parsed.pattern_type,
      }),
    })
    .select("id, category_id, categorization_source, notes")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      // Duplicate — the transaction already exists (same email processed
      // twice, or auto-import raced the queue). Don't lose what the user set
      // in the queue: carry it onto the surviving row, then retire the pending
      // row so it doesn't linger.
      const { data: existingTx } = await supabase
        .from("transactions")
        .select("id, category_id, notes")
        .eq("user_id", user.id)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existingTx) {
        const dupUpdate: {
          category_id?: string;
          categorization_source?: "USER_OVERRIDE";
          notes?: string;
        } = {};
        if (userCategoryId) {
          dupUpdate.category_id = userCategoryId;
          dupUpdate.categorization_source = "USER_OVERRIDE";
        }
        if (userNotes && !existingTx.notes) dupUpdate.notes = userNotes;
        if (Object.keys(dupUpdate).length > 0) {
          await supabase
            .from("transactions")
            .update(dupUpdate)
            .eq("user_id", user.id)
            .eq("id", existingTx.id);
        }
        await attachQueueTags(supabase, user.id, existingTx.id, userTagIds);
        if (userCategoryId) {
          await learnCategoryFromApproval({
            supabase,
            userId: user.id,
            categoryId: userCategoryId,
            merchantName,
            cleanDescription,
            rawDescription,
            destinatarioId,
          });
        }
      }

      await supabase
        .from("pending_email_transactions")
        .update({ status: "imported" })
        .eq("id", pendingId)
        .eq("user_id", user.id)
        .eq("status", "pending");
      revalidateFinancialViews();
      updateTag("email-ingest");
      if (userTagIds.length > 0) updateTag("tags");
      return { success: true, data: null };
    }
    return { success: false, error: insertError.message };
  }

  if (insertedTx) {
    await linkTransactionToOccurrence(
      accountId, parsed.transaction_date,
      parsed.amount, parsed.direction, insertedTx.id,
      destinatarioId,
    );

    await attachQueueTags(supabase, user.id, insertedTx.id, userTagIds);
  }

  // Category that ends up on the surviving transaction. The reconcile merge
  // below can override it when the existing row carries a user-set category
  // with higher authority.
  let finalCategoryId: string | null = categoryId;

  // Reconcile with existing manual transaction if requested
  if (reconcileWithTransactionId && insertedTx) {
    const { data: manualTx } = await supabase
      .from("transactions")
      .select(
        "id, category_id, categorization_source, notes, reconciled_into_transaction_id, capture_method, recurrence_group_id"
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

      finalCategoryId = merged.category_id ?? null;
      const categoryCarriedFromExisting =
        (merged.category_id ?? null) !== (insertedTx.category_id ?? null);

      await supabase
        .from("transactions")
        .update({
          category_id: merged.category_id ?? null,
          // The source must travel with the category: a carried-over
          // USER_OVERRIDE must not be relabelled as an automatic guess, and a
          // rejected queue category must not keep claiming USER_OVERRIDE.
          ...(categoryCarriedFromExisting
            ? { categorization_source: manualTx.categorization_source }
            : {}),
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

      // The manual row may already be the payment of a recurring occurrence
      // ("Confirmar pago" before the bank email arrived). Carry that link to
      // the surviving email row so the occurrence points at a visible tx.
      await carryRecurringLinkToSurvivor({
        supabase,
        userId: user.id,
        supersededId: manualTx.id,
        survivorId: insertedTx.id,
        recurrenceGroupId: manualTx.recurrence_group_id,
      });
    }
  }

  // A category chosen in the queue teaches the same rule as categorizing the
  // transaction afterwards would, so the next email from this merchant arrives
  // already categorized — but only when that category actually survived the
  // reconcile merge; teaching a rejected category would misfile every future
  // email from the merchant.
  if (insertedTx && userCategoryId && finalCategoryId === userCategoryId) {
    await learnCategoryFromApproval({
      supabase,
      userId: user.id,
      categoryId: userCategoryId,
      merchantName,
      cleanDescription,
      rawDescription,
      destinatarioId,
    });
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
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (updateError) return { success: false, error: updateError.message };

  revalidateFinancialViews();
  updateTag("email-ingest");
  if (userTagIds.length > 0) updateTag("tags");
  return { success: true, data: null };
}

/**
 * Attach the tags picked in the queue to a transaction. `tag_ids` on the
 * pending row has no FK, so a tag deleted between queueing and approval is
 * dropped by the shared helper instead of failing the whole batch;
 * already-attached pairs are ignored (PK on transaction_id + tag_id).
 */
async function attachQueueTags(
  supabase: AuthenticatedSupabase,
  userId: string,
  transactionId: string,
  tagIds: string[],
): Promise<void> {
  const result = await attachTagsToTransactions(supabase, userId, [transactionId], tagIds);
  if (result.error) {
    console.error("[approveEmailTransaction] tag upsert failed:", result.error);
  }
}

async function learnCategoryFromApproval(params: {
  supabase: AuthenticatedSupabase;
  userId: string;
  categoryId: string;
  merchantName: string | null;
  cleanDescription: string | null;
  rawDescription: string | null;
  destinatarioId: string | null;
}): Promise<void> {
  const { supabase, userId, categoryId, destinatarioId } = params;
  const pattern = extractPattern(
    params.merchantName,
    params.cleanDescription,
    params.rawDescription,
  );

  if (pattern) {
    const { error } = await supabase.from("category_rules").upsert(
      { user_id: userId, pattern, category_id: categoryId, match_count: 1 },
      { onConflict: "user_id,pattern" },
    );
    if (error) console.error("[approveEmailTransaction] rule upsert failed:", error.message);
  }

  if (destinatarioId) {
    await supabase
      .from("destinatarios")
      .update({ default_category_id: categoryId })
      .eq("user_id", userId)
      .eq("id", destinatarioId)
      .is("default_category_id", null);
    updateTag("destinatarios");
  }
}

const pendingEnrichmentSchema = z.object({
  categoryId: uuidStr("Categoría inválida").nullable().optional(),
  tagIds: z.array(uuidStr("Etiqueta inválida")).max(20, "Máximo 20 etiquetas").optional(),
  notes: z.string().trim().max(500, "La nota es muy larga").nullable().optional(),
});

export type PendingEmailEnrichment = z.infer<typeof pendingEnrichmentSchema>;

/**
 * Save category / tags / notes on a queued email transaction so they apply
 * when it's imported. Only touches rows still `pending` — an imported or
 * dismissed row is no longer editable.
 */
export async function updatePendingEmailTransaction(
  pendingId: string,
  patch: PendingEmailEnrichment,
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  if (!uuidStr().safeParse(pendingId).success) {
    return { success: false, error: "Transacción pendiente inválida" };
  }
  const parsed = pendingEnrichmentSchema.safeParse(patch);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const { categoryId, tagIds, notes } = parsed.data;

  const update: {
    category_id?: string | null;
    tag_ids?: string[];
    notes?: string | null;
  } = {};

  if (categoryId !== undefined) {
    if (categoryId) {
      const { data: category } = await supabase
        .from("categories")
        .select("id")
        .eq("id", categoryId)
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .maybeSingle();
      if (!category) return { success: false, error: "Categoría no encontrada" };
    }
    update.category_id = categoryId;
  }

  if (tagIds !== undefined) {
    const uniqueTagIds = [...new Set(tagIds)];
    if (uniqueTagIds.length > 0) {
      const { count } = await supabase
        .from("tags")
        .select("id", { count: "exact", head: true })
        .in("id", uniqueTagIds)
        .or(`user_id.eq.${user.id},user_id.is.null`);
      if ((count ?? 0) !== uniqueTagIds.length) {
        return { success: false, error: "Etiqueta no encontrada" };
      }
    }
    update.tag_ids = uniqueTagIds;
  }

  if (notes !== undefined) {
    update.notes = notes ? notes : null;
  }

  if (Object.keys(update).length === 0) return { success: true, data: null };

  const { data: updated, error } = await supabase
    .from("pending_email_transactions")
    .update(update)
    .eq("id", pendingId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!updated) return { success: false, error: "Transacción pendiente no encontrada" };

  updateTag("email-ingest");
  return { success: true, data: null };
}

/**
 * Ingest-address default for a queued row that carries no account. Only
 * unmasked alerts may fall back to it: a masked alert nobody matched is a
 * product the user hasn't registered, and quietly importing it into the
 * default account is how a new credit card's purchases became savings
 * spending.
 */
async function resolveIngestDefaultAccountId(
  supabase: AuthenticatedSupabase,
  userId: string,
  pending: Pick<PendingEmailTransaction, "email_ingest_id">,
  parsed: Pick<ParsedEmailTransaction, "card_last4">,
): Promise<string | null> {
  if (normalizeAccountMaskSuffix(parsed.card_last4)) return null;
  const { data: ingestAddress } = await supabase
    .from("email_ingest_addresses")
    .select("account_id")
    .eq("id", pending.email_ingest_id)
    .eq("user_id", userId)
    .single();
  return ingestAddress?.account_id ?? null;
}

// ─── Unrecognized products (new cards / accounts) ────────────────────────────

const emailProductSchema = z.object({
  cardType: z.enum(["T.Deb", "T.Cred", "Cta", "producto"]),
  last4: z
    .string()
    .transform((value) => normalizeAccountMaskSuffix(value) ?? "")
    .pipe(z.string().regex(/^\d{1,4}$/, "Máscara inválida")),
});

/** The product an alert names: which kind of card/account and its last four. */
export type EmailProductRef = z.input<typeof emailProductSchema>;

const createEmailProductAccountSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido").max(100, "El nombre es muy largo"),
  accountType: z.enum(["CREDIT_CARD", "SAVINGS", "CHECKING"]),
  currencyCode: accountSchema.shape.currency_code,
});

export type CreateEmailProductAccountInput = z.input<typeof createEmailProductAccountSchema>;

export type EmailProductResolution = {
  account: Account;
  /** Queued rows from the same product, now suggested into `account`. */
  pendingIds: string[];
  /** The account is in place but the queue could not be re-suggested. */
  warning?: string;
};

const PENDING_REASSIGN_CHUNK = 100;

function stripAccountSecrets(account: Tables<"accounts">): Account {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- dropped on purpose
  const { pdf_password, ...rest } = account;
  return rest;
}

/**
 * Point every queued alert from this product at `accountId`, so registering
 * a card once resolves the whole backlog and every surface (web inbox,
 * mobile panel, attention items) sees the same suggestion after refresh.
 */
async function reassignPendingRowsForProduct(
  supabase: AuthenticatedSupabase,
  userId: string,
  product: z.output<typeof emailProductSchema>,
  accountId: string,
): Promise<{ pendingIds: string[]; warning?: string }> {
  const warning = "La cola de correos no se pudo actualizar; recarga para verla al día.";
  const { data: rows, error } = await supabase
    .from("pending_email_transactions")
    .select("id, parsed_data")
    .eq("user_id", userId)
    .eq("status", "pending");
  if (error) {
    console.error("[email-ingest] pending lookup for product failed:", error.message);
    return { pendingIds: [], warning };
  }

  const kind = emailProductKind(product.cardType);
  const ids = (rows ?? [])
    .filter((row) => {
      const parsed = row.parsed_data as unknown as ParsedEmailTransaction | null;
      return (
        !!parsed &&
        emailProductKind(parsed.card_type) === kind &&
        accountMaskSuffixMatches(parsed.card_last4, product.last4)
      );
    })
    .map((row) => row.id);

  // Chunked: the id list travels in the PostgREST query string.
  for (let i = 0; i < ids.length; i += PENDING_REASSIGN_CHUNK) {
    const chunk = ids.slice(i, i + PENDING_REASSIGN_CHUNK);
    const { error: updateError } = await supabase
      .from("pending_email_transactions")
      .update({ suggested_account_id: accountId })
      .in("id", chunk)
      .eq("user_id", userId);
    if (updateError) {
      console.error("[email-ingest] pending reassignment failed:", updateError.message);
      return { pendingIds: ids.slice(0, i), warning };
    }
  }
  return { pendingIds: ids };
}

function revalidateAfterProductResolution() {
  updateTag("accounts");
  updateTag("dashboard:accounts");
  updateTag("dashboard:hero");
  updateTag("debt");
  updateTag("attention");
  updateTag("email-ingest");
}

/**
 * Attach the product an alert names (debit card, credit card, account
 * number) to an existing account, and re-suggest every queued alert from
 * it. The "esta tarjeta ya es de una cuenta que tengo" answer to the
 * "producto no registrado" prompt.
 */
export async function linkEmailProductToAccount(
  product: EmailProductRef,
  accountId: string,
): Promise<ActionResult<EmailProductResolution>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  if (!uuidStr().safeParse(accountId).success) {
    return { success: false, error: "Cuenta inválida" };
  }
  const parsedProduct = emailProductSchema.safeParse(product);
  if (!parsedProduct.success) {
    return { success: false, error: parsedProduct.error.issues[0].message };
  }
  const ref = parsedProduct.data;

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (accountError) return { success: false, error: accountError.message };
  if (!account) return { success: false, error: "Cuenta no encontrada" };

  if (!accountFitsEmailProduct(account.account_type, ref.cardType)) {
    return {
      success: false,
      error: `${describeEmailProduct({ card_type: ref.cardType, card_last4: ref.last4 })} no puede asociarse a esta cuenta`,
    };
  }

  let current: Tables<"accounts"> = account;
  const learned = emailProductMaskToLearn({
    account,
    cardType: ref.cardType,
    last4: ref.last4,
    explicit: true,
  });
  // An account number never overwrites a different one (that's another
  // account, and the mask is what PDF statements match on). Say so instead
  // of "succeeding" with nothing learned — the next alert would just ask again.
  if (!learned && !accountCarriesEmailProduct(account, ref.cardType, ref.last4)) {
    const known = normalizeAccountMaskSuffix(account.mask);
    return {
      success: false,
      error: `${account.name} ya tiene registrado el número *${known}. Crea una cuenta nueva para *${ref.last4}.`,
    };
  }
  if (learned) {
    const { data: updated, error: updateError } = await supabase
      .from("accounts")
      .update({ [learned.column]: learned.value })
      .eq("id", accountId)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (updateError) return { success: false, error: updateError.message };
    current = updated;
  }

  const reassigned = await reassignPendingRowsForProduct(supabase, user.id, ref, accountId);
  revalidateAfterProductResolution();
  return { success: true, data: { account: stripAccountSecrets(current), ...reassigned } };
}

/**
 * Create the account for a product no account knows — a brand-new credit
 * card, most often — with just a name and currency. Limit, cutoff, payment
 * day and rate stay empty on purpose: the next PDF statement imported for
 * this card fills them (`importTransactions` updates account metadata).
 */
export async function createAccountForEmailProduct(
  product: EmailProductRef,
  input: CreateEmailProductAccountInput,
): Promise<ActionResult<EmailProductResolution>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsedProduct = emailProductSchema.safeParse(product);
  if (!parsedProduct.success) {
    return { success: false, error: parsedProduct.error.issues[0].message };
  }
  const parsedInput = createEmailProductAccountSchema.safeParse(input);
  if (!parsedInput.success) {
    return { success: false, error: parsedInput.error.issues[0].message };
  }
  const ref = parsedProduct.data;
  const { name, accountType, currencyCode } = parsedInput.data;

  if (!accountFitsEmailProduct(accountType, ref.cardType)) {
    return {
      success: false,
      error: `${describeEmailProduct({ card_type: ref.cardType, card_last4: ref.last4 })} no corresponde a ese tipo de cuenta`,
    };
  }

  // A retry or a second tab must not mint a twin: two accounts carrying the
  // same mask make every later alert from it ambiguous (unsuggestable).
  const { data: existing, error: existingError } = await supabase
    .from("accounts")
    .select("id, name, mask, debit_card_mask, account_type")
    .eq("user_id", user.id)
    .eq("is_active", true);
  if (existingError) return { success: false, error: existingError.message };
  const twin = (existing ?? []).find((a) =>
    accountCarriesEmailProduct(a, ref.cardType, ref.last4),
  );
  if (twin) {
    return {
      success: false,
      error: `${twin.name} ya tiene registrado *${ref.last4}. Asóciala en vez de crear otra.`,
    };
  }

  const maskColumns =
    emailProductKind(ref.cardType) === "debit_card"
      ? { debit_card_mask: ref.last4 }
      : { mask: ref.last4 };

  const { data: created, error: insertError } = await supabase
    .from("accounts")
    .insert({
      user_id: user.id,
      name,
      account_type: accountType,
      institution_name: "Bancolombia",
      bank_key: "bancolombia",
      currency_code: currencyCode,
      current_balance: 0,
      show_in_dashboard: true,
      display_order: (existing?.length ?? 0) + 1,
      ...maskColumns,
    })
    .select("*")
    .single();
  if (insertError) return { success: false, error: insertError.message };

  const reassigned = await reassignPendingRowsForProduct(supabase, user.id, ref, created.id);
  revalidateAfterProductResolution();
  return { success: true, data: { account: stripAccountSecrets(created), ...reassigned } };
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
    accountId = await resolveIngestDefaultAccountId(supabase, user.id, pending, parsed);
  }

  if (!accountId) return { success: true, data: null };

  let duplicate: Awaited<ReturnType<typeof findEmailDuplicateCandidate>>;
  try {
    duplicate = await findEmailDuplicateCandidate({
      client: supabase,
      userId: user.id,
      accountId,
      parsed,
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error" };
  }
  if (!duplicate) return { success: true, data: null };

  const { candidate, match } = duplicate;
  return {
    success: true,
    data: {
      candidate: {
        id: candidate.id,
        raw_description: candidate.raw_description,
        merchant_name: candidate.merchant_name,
        transaction_date: candidate.transaction_date,
        amount: candidate.amount,
        direction: candidate.direction,
        category_id: candidate.category_id,
        score: match.score,
      },
      decision: match.decision as "AUTO_MERGE" | "REVIEW",
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
