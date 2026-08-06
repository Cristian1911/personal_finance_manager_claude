"use server";
import { cacheTag, cacheLife, updateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { revalidateFinancialViews } from "@/lib/cache/revalidation";
import { createSharedPaymentSchema } from "@/lib/validators/shared-payment";
import { computeIdempotencyKey } from "@/lib/utils/idempotency";
import { applyAccountBalanceDelta } from "@/lib/utils/account-balance";
import {
  resolveSplitParticipants,
  cleanupAdHocDestinatarios,
  type RawSplitParticipant,
} from "@/lib/personal-debts/ad-hoc";
import { toColombiaDateString } from "@/lib/utils/date";
import { SPLIT_ERROR_MESSAGES } from "@/lib/personal-debts/split-errors";
import {
  computeSplit,
  getCurrencyDecimals,
  isPersonalDebtOverdue,
} from "@zeta/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
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

export type SplitTxConfig = {
  method: "equal" | "amount" | "percent";
  userIncluded: boolean;
  /**
   * Each entry is an existing contact (`destinatario_id`) OR an ad-hoc person
   * (`name`) that gets materialized into a hidden destinatario here. Callers
   * that already hold ids (e.g. `shareModoTransactions`) pass them through
   * untouched — resolution is a no-op when no names are present.
   */
  participants: RawSplitParticipant[];
  opened_on: string;
  due_date?: string | null;
  description?: string | null;
};

/**
 * Repartir UNA transacción existente (OUTFLOW, sin split_group_id ni
 * personal_debt_id): la tx se mantiene intacta (monto/categoría/comercio), solo
 * se tagea al split group + se resetea split_repaid_amount, y se insertan N
 * personal_debts (lent) que la referencian. NO aplica delta de saldo (la tx ya
 * posteó su efectivo). El caller garantiza la elegibilidad de la tx.
 *
 * Compartido por `createSharedPayment` (modo "existing") y el batch del modo
 * compartido (`shareModoTransactions`) — una sola regla de reparto.
 */
export async function splitExistingTransaction(
  supabase: SupabaseClient<Database>,
  userId: string,
  tx: { id: string; amount: number; currency_code: string },
  config: SplitTxConfig,
): Promise<
  | { ok: true; split_group_id: string; debt_ids: string[] }
  | { ok: false; error: string }
> {
  // Materialize any ad-hoc (typed-name) participants first — every debt needs a
  // destinatario_id. Done BEFORE the split math so a resolution failure costs
  // nothing but the hidden rows we clean up on the error paths below.
  const resolved = await resolveSplitParticipants(supabase, userId, config.participants);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const { participants: people, createdIds } = resolved;

  const decimals = getCurrencyDecimals(tx.currency_code as CurrencyCode);
  const split = computeSplit({
    total: tx.amount,
    method: config.method,
    participants: people.map((x) => ({
      destinatario_id: x.destinatario_id,
      value: x.value,
    })),
    userIncluded: config.userIncluded,
    decimals,
  });
  if (!split.ok) {
    await cleanupAdHocDestinatarios(supabase, userId, createdIds);
    return { ok: false, error: SPLIT_ERROR_MESSAGES[split.reason] };
  }

  const splitGroupId = crypto.randomUUID();
  const { error: updErr } = await supabase
    .from("transactions")
    .update({ split_group_id: splitGroupId, split_repaid_amount: 0 })
    .eq("id", tx.id)
    .eq("user_id", userId);
  if (updErr) {
    await cleanupAdHocDestinatarios(supabase, userId, createdIds);
    return { ok: false, error: "Error al marcar la transacción como pago compartido" };
  }

  const debtIds: string[] = [];
  const debtsToInsert: PersonalDebtInsert[] = split.shares.map((share) => {
    const debtId = crypto.randomUUID();
    debtIds.push(debtId);
    return {
      id: debtId,
      user_id: userId,
      destinatario_id: share.destinatario_id!,
      direction: "lent",
      principal_amount: share.amount,
      outstanding_amount: share.amount,
      currency_code: tx.currency_code,
      opened_on: config.opened_on,
      due_date: config.due_date ?? null,
      notes: config.description ?? null,
      status: "active",
      split_group_id: splitGroupId,
      origin_transaction_id: tx.id,
    };
  });
  const { error: debtsErr } = await supabase.from("personal_debts").insert(debtsToInsert);
  if (debtsErr) {
    // Compensating: un-tag (no hubo delta de saldo — la tx ya estaba posteada)
    // y borrar las personas ad-hoc que quedaron sin respaldo.
    await supabase
      .from("transactions")
      .update({ split_group_id: null, split_repaid_amount: null })
      .eq("id", tx.id)
      .eq("user_id", userId);
    await cleanupAdHocDestinatarios(supabase, userId, createdIds);
    return { ok: false, error: "Error al crear las deudas del reparto" };
  }

  return { ok: true, split_group_id: splitGroupId, debt_ids: debtIds };
}

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
  // "existing" mode: la tx ya está posteada — repartirla vía el helper
  // compartido (misma regla que el batch del modo). Sin delta de saldo.
  // ----------------------------------------------------------------
  if (p.mode === "existing") {
    const res = await splitExistingTransaction(
      supabase,
      user.id,
      { id: existingTxId!, amount: total, currency_code: currency },
      {
        method: p.method,
        userIncluded: p.user_included,
        participants: p.participants,
        opened_on: paidOn,
        due_date: p.due_date,
        description: p.description,
      },
    );
    if (!res.ok) return { success: false, error: res.error };
    revalidateFinancialViews();
    updateTag("personal-debts");
    return {
      success: true,
      data: { split_group_id: res.split_group_id, debt_ids: res.debt_ids },
    };
  }

  // ----------------------------------------------------------------
  // Compute the split (exact-sum guaranteed by @zeta/shared). The participant
  // shares are what is owed to the user; their sum = total − userShare.
  // ----------------------------------------------------------------
  // Ad-hoc (typed-name) participants become hidden destinatarios before any of
  // the money moves, so every debt below has a real destinatario_id to point at.
  const resolved = await resolveSplitParticipants(supabase, user.id, p.participants);
  if (!resolved.ok) return { success: false, error: resolved.error };
  const { participants: people, createdIds } = resolved;

  const decimals = getCurrencyDecimals(currency as CurrencyCode);
  const split = computeSplit({
    total,
    method: p.method,
    participants: people.map((x) => ({
      destinatario_id: x.destinatario_id,
      value: x.value,
    })),
    userIncluded: p.user_included,
    decimals,
  });
  if (!split.ok) {
    await cleanupAdHocDestinatarios(supabase, user.id, createdIds);
    return { success: false, error: SPLIT_ERROR_MESSAGES[split.reason] };
  }
  const { shares } = split;

  const splitGroupId = crypto.randomUUID();
  const currencyEnum = currency as CurrencyEnum;
  const description = p.description ?? "Pago compartido";

  // ----------------------------------------------------------------
  // 1) Create ONE real expense transaction for the full total. The account
  //    balance is applied LAST (step 3) so a failed debts insert leaves no
  //    balance drift — only after tx + debts both land do we move the cash.
  //    ("existing" mode returned early above via splitExistingTransaction.)
  // ----------------------------------------------------------------
  const originTransactionId = crypto.randomUUID();
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
    await cleanupAdHocDestinatarios(supabase, user.id, createdIds);
    if (insErr.code === "23505") {
      return { success: false, error: "Este pago compartido ya existe (duplicado)" };
    }
    return { success: false, error: "Error al registrar el pago compartido" };
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
    // (no balance has been applied yet — see step 3).
    await supabase.from("transactions").delete().eq("id", originTransactionId).eq("user_id", user.id);
    await cleanupAdHocDestinatarios(supabase, user.id, createdIds);
    return { success: false, error: "Error al crear las deudas del reparto" };
  }

  // ----------------------------------------------------------------
  // 3) tx + debts are in place — apply the ONE balance delta now.
  // ----------------------------------------------------------------
  {
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

  // Who the group's debts pointed at, captured BEFORE the delete so any ad-hoc
  // (hidden) person left with nothing behind them can be garbage-collected.
  const { data: groupDebts } = await supabase
    .from("personal_debts")
    .select("destinatario_id")
    .eq("user_id", user.id)
    .eq("split_group_id", splitGroupId);
  const touchedDestinatarioIds = (groupDebts ?? [])
    .map((d) => d.destinatario_id)
    .filter((id): id is string => !!id);

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

  await cleanupAdHocDestinatarios(supabase, user.id, touchedDestinatarioIds);

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
      destinatario:destinatarios!personal_debts_destinatario_id_fkey ( name, default_category_id, is_ad_hoc ),
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
        .select("id, amount, split_repaid_amount, raw_description, transaction_date, account_id")
        .eq("user_id", userId)
        .in("id", originIds)
    : { data: [] as { id: string; amount: number | null; split_repaid_amount: number | null; raw_description: string | null; transaction_date: string; account_id: string | null }[] };
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
      destinatario_is_ad_hoc: !!row.destinatario?.is_ad_hoc,
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
    // `split_repaid_amount` lives on the origin transaction, so a group with no
    // origin tx — a debt split via `splitPersonalDebt` that was never backed by
    // a recorded payment — has nowhere to store it. Derive it from the debts
    // instead, using the same rule as `recomputeSplitRepaid`: a settled share
    // counts in full (the user marked it resolved without a transaction),
    // everything else counts what was actually repaid, clamped per participant.
    const recovered = originTx
      ? Number(originTx.split_repaid_amount ?? 0)
      : gdebts.reduce((s, d) => {
          const principal = Number(d.principal_amount ?? 0);
          return s + (d.status === "settled" ? principal : Math.min(d.total_repaid, principal));
        }, 0);
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
      // Where the shared expense was actually paid from — the sensible default
      // account for repayments (money comes back to the account it left from,
      // never onto a credit card).
      origin_account_id: originTx?.account_id ?? null,
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
