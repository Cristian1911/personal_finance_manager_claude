"use server";
import { cacheTag, cacheLife, updateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { revalidateFinancialViews } from "@/lib/cache/revalidation";
import { createSharedPaymentSchema } from "@/lib/validators/shared-payment";
import { computeIdempotencyKey } from "@/lib/utils/idempotency";
import { applyAccountBalanceDelta } from "@/lib/utils/account-balance";
import { toColombiaDateString } from "@/lib/utils/date";
import {
  computeSplit,
  getCurrencyDecimals,
  isPersonalDebtOverdue,
  type SplitErrorReason,
} from "@zeta/shared";
import type { ActionResult } from "@/types/actions";
import type { Database } from "@/types/database";
import type {
  CurrencyCode,
  PersonalDebtWithDetails,
  SharedPaymentGroup,
} from "@/types/domain";

type CurrencyEnum = Database["public"]["Enums"]["currency_code"];
type PersonalDebtInsert = Database["public"]["Tables"]["personal_debts"]["Insert"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CreateSharedPaymentResult = ActionResult<{
  split_group_id: string;
  debt_ids: string[];
}>;

const SPLIT_ERROR_MESSAGES: Record<SplitErrorReason, string> = {
  no_participants: "Agrega al menos una persona",
  invalid_total: "El monto total no es válido",
  negative_value: "Los valores no pueden ser negativos",
  amount_sum_exceeds_total: "Las partes asignadas superan el total del pago",
  amount_sum_mismatch: "Las partes deben sumar exactamente el total del pago",
  percent_out_of_range: "Los porcentajes superan el 100%",
  percent_sum_mismatch: "Los porcentajes deben sumar 100%",
};

/**
 * Create a shared payment ("Pago compartido", Splitwise-style): ONE real
 * transaction (the full payment) plus N personal_debts (direction 'lent'),
 * grouped by a `split_group_id`. The debts reference the transaction via
 * `origin_transaction_id` (one tx can be the origin for N debts).
 *
 * The transaction keeps its full amount and stays a normal expense
 * (`personal_debt_id = NULL`). Its EFFECTIVE spend is `amount −
 * split_repaid_amount`, which starts at the full amount and decreases as
 * participants repay (recordRepayment recomputes split_repaid_amount). This
 * means a single transaction matches the bank statement on import (no
 * duplicate legs) while the user's spend still converges to their own share.
 *
 * Two entry modes:
 *   - "existing": split an already-recorded OUTFLOW. The tx is kept UNMODIFIED
 *     (amount, category, merchant); we only tag it with the split_group_id and
 *     reset split_repaid_amount. No balance change (cash already posted).
 *   - "new": create ONE transaction for the full total + apply one balance delta.
 */
export async function createSharedPayment(
  _prev: CreateSharedPaymentResult | undefined,
  formData: FormData,
): Promise<CreateSharedPaymentResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // participants arrives as a JSON-encoded array in the FormData.
  let participantsRaw: unknown = [];
  try {
    participantsRaw = JSON.parse(String(formData.get("participants") ?? "[]"));
  } catch {
    return { success: false, error: "Datos de personas inválidos" };
  }

  const parsed = createSharedPaymentSchema.safeParse({
    mode: formData.get("mode"),
    origin_transaction_id: formData.get("origin_transaction_id") || undefined,
    account_id: formData.get("account_id") || undefined,
    total_amount: formData.get("total_amount") || undefined,
    paid_on: formData.get("paid_on") || undefined,
    currency_code: formData.get("currency_code") || "COP",
    description: formData.get("description") || undefined,
    method: formData.get("method") || "equal",
    user_included: formData.get("user_included"),
    due_date: formData.get("due_date") || undefined,
    participants: participantsRaw,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const p = parsed.data;

  // ----------------------------------------------------------------
  // Resolve total / account / date / currency from the chosen mode.
  // ----------------------------------------------------------------
  let total: number;
  let accountId: string;
  let currency: string;
  let paidOn: string;
  let existingTxId: string | null = null;

  if (p.mode === "existing") {
    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .select("id, amount, direction, account_id, currency_code, transaction_date, personal_debt_id, split_group_id")
      .eq("id", p.origin_transaction_id!)
      .eq("user_id", user.id)
      .single();
    if (txErr || !tx) return { success: false, error: "Transacción no encontrada" };
    if (tx.direction !== "OUTFLOW") {
      return { success: false, error: "Solo puedes repartir un gasto (salida de dinero)" };
    }
    if (tx.personal_debt_id) {
      return { success: false, error: "Esta transacción ya está vinculada a una persona" };
    }
    if (tx.split_group_id) {
      return { success: false, error: "Esta transacción ya fue repartida" };
    }
    if (tx.amount == null || tx.account_id == null || tx.currency_code == null) {
      return { success: false, error: "La transacción no tiene los datos requeridos" };
    }
    total = Number(tx.amount);
    accountId = tx.account_id;
    currency = tx.currency_code;
    paidOn = tx.transaction_date;
    existingTxId = tx.id;
  } else {
    total = p.total_amount!;
    accountId = p.account_id!;
    currency = p.currency_code;
    paidOn = p.paid_on ?? toColombiaDateString(new Date());
  }

  // ----------------------------------------------------------------
  // Compute the split (exact-sum guaranteed by @zeta/shared). The participant
  // shares are what is owed to the user; their sum = total − userShare.
  // ----------------------------------------------------------------
  const decimals = getCurrencyDecimals(currency as CurrencyCode);
  const split = computeSplit({
    total,
    method: p.method,
    participants: p.participants.map((x) => ({
      destinatario_id: x.destinatario_id,
      value: x.value,
    })),
    userIncluded: p.user_included,
    decimals,
  });
  if (!split.ok) {
    return { success: false, error: SPLIT_ERROR_MESSAGES[split.reason] };
  }
  const { shares } = split;

  const splitGroupId = crypto.randomUUID();
  const currencyEnum = currency as CurrencyEnum;
  const description = p.description ?? "Pago compartido";

  // ----------------------------------------------------------------
  // 1) Establish the single origin transaction. The account balance is applied
  //    LAST (step 3) so a failed debts insert leaves no balance drift — only
  //    after the tx + debts both land do we move the cash.
  // ----------------------------------------------------------------
  let originTransactionId: string;

  if (p.mode === "existing") {
    // Keep the original transaction UNMODIFIED (amount, category, merchant) — only
    // tag it to the split group and reset the repaid tracker. No balance change.
    originTransactionId = existingTxId!;
    const { error: updErr } = await supabase
      .from("transactions")
      .update({ split_group_id: splitGroupId, split_repaid_amount: 0 })
      .eq("id", originTransactionId)
      .eq("user_id", user.id);
    if (updErr) return { success: false, error: "Error al marcar la transacción como pago compartido" };
  } else {
    // Create ONE real expense transaction for the full total.
    originTransactionId = crypto.randomUUID();
    const idempotencyKey = await computeIdempotencyKey({
      provider: "MANUAL",
      providerTransactionId: `split:${splitGroupId}:origin`,
      transactionDate: paidOn,
      amount: total,
      rawDescription: description,
    });
    const { error: insErr } = await supabase.from("transactions").insert({
      id: originTransactionId,
      user_id: user.id,
      account_id: accountId,
      amount: total,
      direction: "OUTFLOW",
      currency_code: currencyEnum,
      transaction_date: paidOn,
      raw_description: description,
      provider: "MANUAL",
      capture_method: "MANUAL_FORM",
      idempotency_key: idempotencyKey,
      split_group_id: splitGroupId,
      split_repaid_amount: 0,
    });
    if (insErr) {
      if (insErr.code === "23505") {
        return { success: false, error: "Este pago compartido ya existe (duplicado)" };
      }
      return { success: false, error: "Error al registrar el pago compartido" };
    }
  }

  // ----------------------------------------------------------------
  // 2) One personal_debts (lent) per participant, all pointing at the origin tx.
  // ----------------------------------------------------------------
  const debtIds: string[] = [];
  const debtsToInsert: PersonalDebtInsert[] = shares.map((share) => {
    const debtId = crypto.randomUUID();
    debtIds.push(debtId);
    return {
      id: debtId,
      user_id: user.id,
      destinatario_id: share.destinatario_id!,
      direction: "lent",
      principal_amount: share.amount,
      outstanding_amount: share.amount,
      currency_code: currency,
      opened_on: paidOn,
      due_date: p.due_date ?? null,
      notes: p.description ?? null,
      status: "active",
      split_group_id: splitGroupId,
      origin_transaction_id: originTransactionId,
    };
  });
  const { error: debtsErr } = await supabase.from("personal_debts").insert(debtsToInsert);
  if (debtsErr) {
    // Compensating cleanup so we never leave an orphaned split tx with no debts
    // (and, in new mode, no balance has been applied yet — see step 3).
    if (p.mode === "new") {
      await supabase.from("transactions").delete().eq("id", originTransactionId).eq("user_id", user.id);
    } else {
      await supabase
        .from("transactions")
        .update({ split_group_id: null, split_repaid_amount: null })
        .eq("id", originTransactionId)
        .eq("user_id", user.id);
    }
    return { success: false, error: "Error al crear las deudas del reparto" };
  }

  // ----------------------------------------------------------------
  // 3) New mode: tx + debts are in place — apply the ONE balance delta now.
  // ----------------------------------------------------------------
  if (p.mode === "new") {
    const { data: acct, error: acctErr } = await supabase
      .from("accounts")
      .select("id, account_type, current_balance")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();
    if (acctErr || !acct || acct.account_type == null) {
      return { success: false, error: "Cuenta no encontrada para aplicar el saldo" };
    }
    const nextBalance = applyAccountBalanceDelta({
      currentBalance: acct.current_balance ?? 0,
      accountType: acct.account_type,
      direction: "OUTFLOW",
      amount: total,
    });
    const { error: balErr } = await supabase
      .from("accounts")
      .update({ current_balance: nextBalance })
      .eq("id", accountId)
      .eq("user_id", user.id);
    if (balErr) return { success: false, error: "Error al actualizar el saldo de la cuenta" };
  }

  revalidateFinancialViews();
  updateTag("personal-debts");
  return { success: true, data: { split_group_id: splitGroupId, debt_ids: debtIds } };
}

// ============================================================
// Delete a shared payment: removes the group's debts and un-splits the origin
// transaction (the real payment is KEPT — only the split metadata is cleared).
// Also cleans legacy "lent-origin legs" from the old N+1 model (txs tagged to the
// group that carry a personal_debt_id); repayments are never deleted (they have
// no split_group_id).
// ============================================================
export async function deleteSharedPayment(
  splitGroupId: string,
): Promise<ActionResult<undefined>> {
  if (!UUID_RE.test(splitGroupId)) return { success: false, error: "ID inválido" };
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // Legacy cleanup: old per-participant legs carried split_group_id + a
  // personal_debt_id. The new-model origin tx has personal_debt_id null, so this
  // is a no-op there.
  const { error: legacyErr } = await supabase
    .from("transactions")
    .delete()
    .eq("user_id", user.id)
    .eq("split_group_id", splitGroupId)
    .not("personal_debt_id", "is", null);
  if (legacyErr) {
    console.error("deleteSharedPayment legacy-leg cleanup failed:", legacyErr);
    return { success: false, error: "Error al eliminar el pago compartido" };
  }

  // Deleting the debts cascades `ON DELETE SET NULL` onto their repayment
  // transactions (transactions.personal_debt_id). Those INFLOWs then pass the
  // `.is("personal_debt_id", null)` cashflow filter and start counting as income
  // — net cash-correct, but a visible metric swing. Repayments are real money
  // received, so they are intentionally NOT deleted here.
  const { error: debtErr } = await supabase
    .from("personal_debts")
    .delete()
    .eq("user_id", user.id)
    .eq("split_group_id", splitGroupId);
  if (debtErr) {
    console.error("deleteSharedPayment debt delete failed:", debtErr);
    return { success: false, error: "Error al eliminar el pago compartido" };
  }

  // Un-split the real transaction(s): keep them, drop the split metadata. Surface
  // a failure here — otherwise the debts are gone but the tx stays tagged as a
  // split (inconsistent state).
  const { error: untagErr } = await supabase
    .from("transactions")
    .update({ split_group_id: null, split_repaid_amount: null })
    .eq("user_id", user.id)
    .eq("split_group_id", splitGroupId);
  if (untagErr) {
    console.error("deleteSharedPayment un-split failed:", untagErr);
    return { success: false, error: "Error al eliminar el pago compartido" };
  }

  revalidateFinancialViews();
  updateTag("personal-debts");
  return { success: true, data: undefined };
}

// ============================================================
// Read: shared-payment groups (for the Deudas personales page).
// Shares the "personal-debts" cache tag so debt mutations refresh it.
// ============================================================
async function getSharedPaymentGroupsCached(
  accessToken: string,
  userId: string,
): Promise<SharedPaymentGroup[]> {
  "use cache";
  cacheTag("personal-debts");
  cacheLife("zeta");
  const supabase = createCachedClient(accessToken);

  const { data: debts, error } = await supabase
    .from("personal_debts")
    .select(`
      id, user_id, destinatario_id, direction, principal_amount,
      currency_code, outstanding_amount, opened_on, due_date, status,
      origin_transaction_id, notes, is_demo, created_at, updated_at, split_group_id,
      destinatario:destinatarios!personal_debts_destinatario_id_fkey ( name, default_category_id ),
      repayments:transactions!transactions_enc_personal_debt_id_fkey ( amount, pd_role )
    `)
    .eq("user_id", userId)
    .not("split_group_id", "is", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!debts || debts.length === 0) return [];

  // The single origin transaction per group carries the full total + how much
  // has been repaid so far (split_repaid_amount).
  const originIds = [
    ...new Set(debts.map((d) => d.origin_transaction_id).filter((x): x is string => !!x)),
  ];
  const { data: originTxs } = originIds.length
    ? await supabase
        .from("transactions")
        .select("id, amount, split_repaid_amount, raw_description, transaction_date")
        .eq("user_id", userId)
        .in("id", originIds)
    : { data: [] as { id: string; amount: number | null; split_repaid_amount: number | null; raw_description: string | null; transaction_date: string }[] };
  const txById = new Map((originTxs ?? []).map((t) => [t.id, t]));

  const today = toColombiaDateString(new Date());
  const byGroup = new Map<string, PersonalDebtWithDetails[]>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of debts as any[]) {
    const gid = row.split_group_id as string;
    const repayments: number[] = (row.repayments ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((t: any) => t.pd_role === "repayment")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((t: any) => t.amount as number);
    const total_repaid = repayments.reduce((s: number, n: number) => s + n, 0);
    const mapped = {
      ...row,
      destinatario_name: row.destinatario?.name ?? "—",
      destinatario_default_category_id: row.destinatario?.default_category_id ?? null,
      total_repaid,
      is_overdue: isPersonalDebtOverdue(row.due_date, row.status, today),
    } as PersonalDebtWithDetails;
    const arr = byGroup.get(gid) ?? [];
    arr.push(mapped);
    byGroup.set(gid, arr);
  }

  const groups: SharedPaymentGroup[] = [];
  for (const [gid, gdebts] of byGroup) {
    const principalSum = gdebts.reduce((s, d) => s + d.principal_amount, 0);
    const originTx = gdebts[0].origin_transaction_id
      ? txById.get(gdebts[0].origin_transaction_id)
      : undefined;
    // total = the real payment; userShare = total − Σ(owed); recovered = repaid.
    const total = originTx?.amount != null ? Number(originTx.amount) : principalSum;
    const recovered = Number(originTx?.split_repaid_amount ?? 0);
    const userShare = Math.max(0, total - principalSum);
    const outstanding = gdebts
      .filter((d) => d.status === "active")
      .reduce((s, d) => s + d.outstanding_amount, 0);
    groups.push({
      split_group_id: gid,
      total,
      userShare,
      recovered,
      currency_code: gdebts[0].currency_code,
      paid_on: originTx?.transaction_date ?? gdebts[0].opened_on,
      description: gdebts[0].notes ?? originTx?.raw_description ?? null,
      outstanding_total: outstanding,
      debts: gdebts,
    });
  }
  groups.sort((a, b) => (a.paid_on < b.paid_on ? 1 : a.paid_on > b.paid_on ? -1 : 0));
  return groups;
}

export async function getSharedPaymentGroups(): Promise<
  ActionResult<SharedPaymentGroup[]>
> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  try {
    const data = await getSharedPaymentGroupsCached(accessToken, user.id);
    return { success: true, data };
  } catch {
    return { success: false, error: "Error al cargar los pagos compartidos" };
  }
}
