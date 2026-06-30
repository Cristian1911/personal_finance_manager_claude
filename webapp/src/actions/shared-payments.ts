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
type TransactionInsert = Database["public"]["Tables"]["transactions"]["Insert"];

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
 * Create a shared payment ("Pago compartido", Splitwise-style): one payment the
 * user made, split across themselves and N other people. Modeled as N+1
 * transaction legs sharing a `split_group_id`:
 *   - the user's own share = a normal expense leg (counts in cashflow), and
 *   - each participant's share = a "lent-origin" leg (pd_role='origin',
 *     excluded from cashflow) linked 1:1 to a personal_debts row (direction
 *     'lent'). Per-person repayments reuse the existing recordRepayment flow.
 *
 * Two entry modes:
 *   - "new": creates the payment from scratch; applies ONE balance delta for the
 *     full total (the cash leaving the account).
 *   - "existing": splits an already-recorded OUTFLOW. The cash already moved at
 *     import, so NO balance delta is applied; the original transaction becomes
 *     the user-share leg (amount reduced to the user's share) or, when the user
 *     does not participate, is kept as a fully-excluded balance carrier.
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
  // The existing transaction to convert (existing mode only).
  let originTx:
    | {
        id: string;
        amount: number;
        account_id: string;
        currency_code: string;
        transaction_date: string;
        category_id: string | null;
      }
    | null = null;

  if (p.mode === "existing") {
    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .select("id, amount, direction, account_id, currency_code, transaction_date, category_id, personal_debt_id, split_group_id")
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
    originTx = {
      id: tx.id,
      amount: total,
      account_id: tx.account_id,
      currency_code: tx.currency_code,
      transaction_date: tx.transaction_date,
      category_id: tx.category_id ?? null,
    };
  } else {
    total = p.total_amount!;
    accountId = p.account_id!;
    currency = p.currency_code;
    paidOn = p.paid_on ?? toColombiaDateString(new Date());
  }

  // ----------------------------------------------------------------
  // Compute the split (exact-sum guaranteed by @zeta/shared).
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
  const { userShare, shares } = split;

  const splitGroupId = crypto.randomUUID();
  const currencyEnum = currency as CurrencyEnum;
  const description = p.description ?? "Pago compartido";
  // Propagate the source transaction's category to the participant legs so the
  // split rows match the original spend (e.g. "Restaurante") instead of landing
  // uncategorized. New mode has no source → null.
  const legCategoryId: string | null = originTx?.category_id ?? null;

  // Build one transaction-leg insert row (UUID pre-generated so debts can carry
  // origin_transaction_id without a follow-up round-trip, and so all legs batch
  // into a single insert). NEVER carries a balance delta — balance is handled
  // explicitly per mode below.
  async function buildLeg(opts: {
    id: string;
    amount: number;
    destinatario_id: string | null;
    personal_debt_id: string | null;
    pd_role: "origin" | null;
    category_id: string | null;
    idemSuffix: string;
  }) {
    const idempotencyKey = await computeIdempotencyKey({
      provider: "MANUAL",
      providerTransactionId: `split:${splitGroupId}:${opts.idemSuffix}`,
      transactionDate: paidOn,
      amount: opts.amount,
      rawDescription: description,
    });
    return {
      id: opts.id,
      user_id: user!.id,
      account_id: accountId,
      amount: opts.amount,
      direction: "OUTFLOW" as const,
      currency_code: currencyEnum,
      transaction_date: paidOn,
      raw_description: description,
      destinatario_id: opts.destinatario_id,
      category_id: opts.category_id,
      provider: "MANUAL" as const,
      capture_method: "MANUAL_FORM" as const,
      idempotency_key: idempotencyKey,
      personal_debt_id: opts.personal_debt_id,
      pd_role: opts.pd_role,
      split_group_id: splitGroupId,
    };
  }

  // ----------------------------------------------------------------
  // 1) Build N personal_debts (lent) + N lent-origin legs (+ the user-share leg
  //    in "new" mode), then insert each table in ONE batch. UUIDs are generated
  //    up front so each debt carries its origin_transaction_id directly — no
  //    follow-up update. Cuts round-trips from 3*N+1 to 2. The legs never touch
  //    the account balance (the full-total delta in new mode, or the
  //    already-posted original in existing mode, covers them).
  // ----------------------------------------------------------------
  const debtIds: string[] = [];
  const debtsToInsert: PersonalDebtInsert[] = [];
  const legsToInsert: TransactionInsert[] = [];

  for (let i = 0; i < shares.length; i++) {
    const share = shares[i];
    const debtId = crypto.randomUUID();
    const legId = crypto.randomUUID();
    debtIds.push(debtId);

    debtsToInsert.push({
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
      origin_transaction_id: legId,
    });

    legsToInsert.push(
      await buildLeg({
        id: legId,
        amount: share.amount,
        destinatario_id: share.destinatario_id,
        personal_debt_id: debtId,
        pd_role: "origin",
        category_id: legCategoryId,
        idemSuffix: `p${i}`,
      }),
    );
  }

  // The user's own share = a normal expense leg (counts in cashflow). Only in
  // "new" mode; in "existing" mode the original transaction becomes that leg.
  if (p.mode === "new" && userShare > 0) {
    legsToInsert.push(
      await buildLeg({
        id: crypto.randomUUID(),
        amount: userShare,
        destinatario_id: null,
        personal_debt_id: null,
        pd_role: null,
        category_id: legCategoryId,
        idemSuffix: "self",
      }),
    );
  }

  // Insert debts BEFORE legs: transactions.personal_debt_id has an FK to
  // personal_debts, so the debt rows must exist first. Each .insert() is a
  // single atomic statement.
  const { error: debtsErr } = await supabase.from("personal_debts").insert(debtsToInsert);
  if (debtsErr) {
    return { success: false, error: "Error al crear las deudas del reparto" };
  }
  const { error: legsErr } = await supabase.from("transactions").insert(legsToInsert);
  if (legsErr) {
    if (legsErr.code === "23505") {
      return { success: false, error: "Este pago compartido ya existe (duplicado)" };
    }
    return { success: false, error: "Error al registrar el pago compartido" };
  }

  // ----------------------------------------------------------------
  // 2) Balance handling, per mode.
  // ----------------------------------------------------------------
  if (p.mode === "new") {
    // Apply ONE balance delta for the full total (the cash that left the
    // account). The legs above are bookkeeping and carry no delta.
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
  } else {
    // existing mode: the original transaction already posted the full total to
    // the balance — make NO balance change.
    if (userShare > 0) {
      // The original becomes the user-share leg (its amount is reduced to the
      // user's portion, so only that counts as the user's spend).
      const { error: updErr } = await supabase
        .from("transactions")
        .update({ amount: userShare, split_group_id: splitGroupId })
        .eq("id", originTx!.id)
        .eq("user_id", user.id);
      if (updErr) return { success: false, error: "Error al actualizar la transacción original" };
    } else {
      // User does not participate: the whole payment is "me deben". Keep the
      // original as a fully-excluded balance carrier (it preserves the record
      // of the full amount paid) and tag it to the split group.
      const { error: updErr } = await supabase
        .from("transactions")
        .update({ is_excluded: true, split_group_id: splitGroupId })
        .eq("id", originTx!.id)
        .eq("user_id", user.id);
      if (updErr) return { success: false, error: "Error al actualizar la transacción original" };
    }
  }

  revalidateFinancialViews();
  updateTag("personal-debts");
  return { success: true, data: { split_group_id: splitGroupId, debt_ids: debtIds } };
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

  const groupIds = [
    ...new Set(debts.map((d) => d.split_group_id).filter((g): g is string => !!g)),
  ];

  // The user-share leg(s): non-debt, non-excluded transactions tagged to the
  // group. Excluded carriers (user-not-included existing-mode splits) are left
  // out, so userShare is 0 there.
  const { data: legs } = await supabase
    .from("transactions")
    .select("split_group_id, amount, raw_description")
    .eq("user_id", userId)
    .in("split_group_id", groupIds)
    .is("personal_debt_id", null)
    .eq("is_excluded", false);

  const userShareByGroup = new Map<string, number>();
  const descByGroup = new Map<string, string>();
  for (const leg of legs ?? []) {
    if (!leg.split_group_id) continue;
    userShareByGroup.set(
      leg.split_group_id,
      (userShareByGroup.get(leg.split_group_id) ?? 0) + Number(leg.amount ?? 0),
    );
    if (leg.raw_description && !descByGroup.has(leg.split_group_id)) {
      descByGroup.set(leg.split_group_id, leg.raw_description);
    }
  }

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
    const userShare = userShareByGroup.get(gid) ?? 0;
    const outstanding = gdebts
      .filter((d) => d.status === "active")
      .reduce((s, d) => s + d.outstanding_amount, 0);
    groups.push({
      split_group_id: gid,
      total: principalSum + userShare,
      userShare,
      currency_code: gdebts[0].currency_code,
      paid_on: gdebts[0].opened_on,
      description: gdebts[0].notes ?? descByGroup.get(gid) ?? null,
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
