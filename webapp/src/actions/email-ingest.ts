"use server";

import { revalidateTag } from "next/cache";
import { nanoid } from "nanoid";
import { autoCategorize } from "@zeta/shared";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import type { ParsedEmailTransaction } from "@/lib/parsers/bancolombia-email";
import { accountMaskSuffixMatches } from "@/lib/utils/account-mask";
import { computeIdempotencyKey } from "@/lib/utils/idempotency";
import type { ActionResult } from "@/types/actions";
import type { EmailIngestAddress, EmailIngestLog, PendingEmailTransaction, UnrecognizedEmail } from "@/types/domain";

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
}): Promise<ActionResult<EmailIngestAddress>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("email_ingest_addresses")
    .update({
      account_id: params.accountId,
      auto_import: params.autoImport,
      ...(params.allowedSender !== undefined && { allowed_sender: params.allowedSender || null }),
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
    .select("currency_code, account_type, debit_card_mask")
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

  // Auto-categorize based on merchant name
  const merchantName = parsed.merchant ?? parsed.destination ?? null;
  const categoryResult = merchantName ? autoCategorize(merchantName) : null;
  const categoryId = categoryResult?.category_id ?? null;

  // Compute idempotency key (reuse the one stored on the pending row when possible)
  const idempotencyKey =
    pending.idempotency_key ||
    (await computeIdempotencyKey({
      provider: "EMAIL_IMPORT",
      transactionDate: parsed.transaction_date,
      amount: parsed.amount,
      rawDescription: parsed.raw_line,
    }));

  const rawDescription = parsed.raw_line;
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
    categorization_source: categoryId ? "SYSTEM_DEFAULT" : undefined,
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
