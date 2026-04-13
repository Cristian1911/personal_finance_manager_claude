"use server";

import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { revalidateFinancialViews } from "@/lib/cache/revalidation";
import { transferSchema } from "@/lib/validators/transfer";
import { computeIdempotencyKey } from "@zeta/shared";
import type { ActionResult } from "@/types/actions";
import type { CurrencyCode } from "@/types/domain";

/**
 * Create a transfer between two accounts.
 * Inserts paired OUTFLOW + INFLOW transactions sharing a transfer_group_id,
 * then updates both account balances following the registerPayment pattern.
 */
export async function createTransfer(
  _prevState: ActionResult<{ outflowId: string; inflowId: string }>,
  formData: FormData
): Promise<ActionResult<{ outflowId: string; inflowId: string }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // 1. Parse & validate
  const raw = {
    fromAccountId: formData.get("fromAccountId") as string,
    toAccountId: formData.get("toAccountId") as string,
    amount: formData.get("amount") as string,
    currencyCode: formData.get("currencyCode") as string,
    date: formData.get("date") as string,
    notes: (formData.get("notes") as string) || undefined,
  };

  const parsed = transferSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { fromAccountId, toAccountId, amount, currencyCode, date, notes } = parsed.data;

  // 2. Fetch both accounts (validate ownership + get balances)
  const [fromRes, toRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, account_type, current_balance, credit_limit, currency_code")
      .eq("id", fromAccountId)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("accounts")
      .select("id, name, account_type, current_balance, credit_limit, currency_code")
      .eq("id", toAccountId)
      .eq("user_id", user.id)
      .single(),
  ]);

  if (fromRes.error || !fromRes.data) {
    return { success: false, error: "Cuenta de origen no encontrada" };
  }
  if (toRes.error || !toRes.data) {
    return { success: false, error: "Cuenta de destino no encontrada" };
  }

  const fromAccount = fromRes.data;
  const toAccount = toRes.data;
  const now = new Date().toISOString();
  const transferGroupId = crypto.randomUUID();

  // 3. Build idempotency keys
  const outflowDescription = `Transferencia a ${toAccount.name}`;
  const inflowDescription = `Transferencia desde ${fromAccount.name}`;

  const [outflowKey, inflowKey] = await Promise.all([
    computeIdempotencyKey({
      provider: "MANUAL",
      transactionDate: date,
      amount,
      rawDescription: outflowDescription,
    }),
    computeIdempotencyKey({
      provider: "MANUAL",
      transactionDate: date,
      amount,
      rawDescription: inflowDescription,
    }),
  ]);

  // 4. Insert OUTFLOW transaction on source account
  const { data: outflow, error: outflowError } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      account_id: fromAccountId,
      amount,
      currency_code: currencyCode as CurrencyCode,
      direction: "OUTFLOW",
      transaction_date: date,
      raw_description: outflowDescription,
      clean_description: outflowDescription,
      merchant_name: toAccount.name,
      capture_method: "MANUAL_FORM",
      provider: "MANUAL",
      categorization_source: "SYSTEM_DEFAULT",
      idempotency_key: outflowKey,
      transfer_group_id: transferGroupId,
      notes: notes || null,
      status: "POSTED",
    })
    .select("id")
    .single();

  if (outflowError) {
    if (outflowError.code === "23505") {
      return { success: false, error: "Esta transferencia ya fue registrada" };
    }
    return { success: false, error: outflowError.message };
  }

  // 5. Insert INFLOW transaction on destination account
  const { data: inflow, error: inflowError } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      account_id: toAccountId,
      amount,
      currency_code: currencyCode as CurrencyCode,
      direction: "INFLOW",
      transaction_date: date,
      raw_description: inflowDescription,
      clean_description: inflowDescription,
      merchant_name: fromAccount.name,
      capture_method: "MANUAL_FORM",
      provider: "MANUAL",
      categorization_source: "SYSTEM_DEFAULT",
      idempotency_key: inflowKey,
      transfer_group_id: transferGroupId,
      notes: notes || null,
      status: "POSTED",
    })
    .select("id")
    .single();

  if (inflowError) {
    // Rollback: delete the outflow transaction
    await supabase.from("transactions").delete().eq("id", outflow.id).eq("user_id", user.id);
    if (inflowError.code === "23505") {
      return { success: false, error: "Esta transferencia ya fue registrada" };
    }
    return { success: false, error: inflowError.message };
  }

  // 6. Update account balances (following registerPayment pattern)
  const isFromDebt = fromAccount.account_type === "CREDIT_CARD" || fromAccount.account_type === "LOAN";
  const isToDebt = toAccount.account_type === "CREDIT_CARD" || toAccount.account_type === "LOAN";

  // FROM account: OUTFLOW → debt increases balance, non-debt decreases balance
  const newFromBalance = isFromDebt
    ? fromAccount.current_balance + amount
    : fromAccount.current_balance - amount;

  const fromUpdate: Record<string, unknown> = {
    current_balance: newFromBalance,
    updated_at: now,
  };
  if (isFromDebt && fromAccount.credit_limit != null) {
    fromUpdate.available_balance = fromAccount.credit_limit - newFromBalance;
  }

  // TO account: INFLOW → debt decreases balance, non-debt increases balance
  const newToBalance = isToDebt
    ? toAccount.current_balance - amount
    : toAccount.current_balance + amount;

  const toUpdate: Record<string, unknown> = {
    current_balance: newToBalance,
    updated_at: now,
  };
  if (isToDebt && toAccount.credit_limit != null) {
    toUpdate.available_balance = toAccount.credit_limit - newToBalance;
  }

  await Promise.all([
    supabase.from("accounts").update(fromUpdate).eq("id", fromAccountId).eq("user_id", user.id),
    supabase.from("accounts").update(toUpdate).eq("id", toAccountId).eq("user_id", user.id),
  ]);

  // 7. Revalidate caches
  revalidateFinancialViews();

  return {
    success: true,
    data: { outflowId: outflow.id, inflowId: inflow.id },
  };
}
