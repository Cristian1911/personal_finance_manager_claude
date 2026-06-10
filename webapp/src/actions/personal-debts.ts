"use server";
import { cacheTag, cacheLife, updateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { revalidateFinancialViews } from "@/lib/cache/revalidation";
import {
  personalDebtIdSchema,
  createPersonalDebtSchema,
  updatePersonalDebtSchema,
  recordRepaymentSchema,
} from "@/lib/validators/personal-debt";
import { computeIdempotencyKey } from "@/lib/utils/idempotency";
import { applyAccountBalanceDelta } from "@/lib/utils/account-balance";
import {
  inferPersonalDebtRole,
  computeOutstanding,
  isPersonalDebtOverdue,
} from "@zeta/shared";
import { toColombiaDateString } from "@/lib/utils/date";
import type { ActionResult } from "@/types/actions";
import type { Database } from "@/types/database";
import type {
  PersonalDebtWithDetails,
  PersonalDebtDirection,
} from "@/types/domain";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================================
// Cached read
// ============================================================
async function getPersonalDebtsCached(
  accessToken: string,
  userId: string,
): Promise<PersonalDebtWithDetails[]> {
  "use cache";
  cacheTag("personal-debts");
  cacheLife("zeta");
  const supabase = createCachedClient(accessToken);

  const { data, error } = await supabase
    .from("personal_debts")
    .select(`
      id, user_id, destinatario_id, direction, principal_amount,
      currency_code, outstanding_amount, opened_on, due_date, status,
      origin_transaction_id, notes, is_demo, created_at, updated_at,
      destinatario:destinatarios!personal_debts_destinatario_id_fkey ( name, default_category_id ),
      repayments:transactions!transactions_enc_personal_debt_id_fkey ( amount, pd_role )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!data) return [];

  const today = toColombiaDateString(new Date());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((row: any) => {
    const repayments: number[] = (row.repayments ?? [])
      .filter((t: any) => t.pd_role === "repayment")
      .map((t: any) => t.amount as number);
    const total_repaid = repayments.reduce((s: number, n: number) => s + n, 0);
    return {
      ...row,
      destinatario_name: row.destinatario?.name ?? "—",
      destinatario_default_category_id: row.destinatario?.default_category_id ?? null,
      total_repaid,
      is_overdue: isPersonalDebtOverdue(row.due_date, row.status, today),
    };
  }) as PersonalDebtWithDetails[];
}

export async function getPersonalDebts(): Promise<ActionResult<PersonalDebtWithDetails[]>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  try {
    const data = await getPersonalDebtsCached(accessToken, user.id);
    return { success: true, data };
  } catch {
    return { success: false, error: "Error al cargar las personas" };
  }
}

// ============================================================
// Overview (Resumen)
// ============================================================
export interface PersonalDebtsOverview {
  iOwe: { total: number; byPerson: { destinatario_name: string; amount: number; currency_code: string }[] };
  owedToMe: { total: number; byPerson: { destinatario_name: string; amount: number; currency_code: string }[] };
  overdue: { destinatario_name: string; amount: number; due_date: string }[];
}

export async function getPersonalDebtsOverview(): Promise<ActionResult<PersonalDebtsOverview>> {
  const res = await getPersonalDebts();
  if (!res.success) return res;
  const active = res.data.filter((d) => d.status === "active");
  const iOwe = active.filter((d) => d.direction === "borrowed");
  const owedToMe = active.filter((d) => d.direction === "lent");
  const sum = (xs: PersonalDebtWithDetails[]) =>
    xs.reduce((s, d) => s + d.outstanding_amount, 0);
  return {
    success: true,
    data: {
      iOwe: {
        total: sum(iOwe),
        byPerson: iOwe.map((d) => ({ destinatario_name: d.destinatario_name, amount: d.outstanding_amount, currency_code: d.currency_code })),
      },
      owedToMe: {
        total: sum(owedToMe),
        byPerson: owedToMe.map((d) => ({ destinatario_name: d.destinatario_name, amount: d.outstanding_amount, currency_code: d.currency_code })),
      },
      overdue: active
        .filter((d) => d.is_overdue)
        .map((d) => ({ destinatario_name: d.destinatario_name, amount: d.outstanding_amount, due_date: d.due_date! })),
    },
  };
}

// ============================================================
// Create
// ============================================================
export async function createPersonalDebt(
  _prev: ActionResult<{ id: string }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = createPersonalDebtSchema.safeParse({
    destinatario_id: formData.get("destinatario_id"),
    direction: formData.get("direction"),
    principal_amount: formData.get("principal_amount"),
    currency_code: formData.get("currency_code") || "COP",
    opened_on: formData.get("opened_on"),
    due_date: formData.get("due_date") || undefined,
    notes: formData.get("notes") || undefined,
    origin_transaction_id: formData.get("origin_transaction_id") || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const p = parsed.data;

  const { data: debt, error } = await supabase
    .from("personal_debts")
    .insert({
      user_id: user.id,
      destinatario_id: p.destinatario_id,
      direction: p.direction,
      principal_amount: p.principal_amount,
      currency_code: p.currency_code,
      outstanding_amount: p.principal_amount,
      opened_on: p.opened_on,
      due_date: p.due_date ?? null,
      notes: p.notes ?? null,
      status: "active",
    })
    .select("id")
    .single();
  if (error || !debt) return { success: false, error: "Error al crear la deuda" };

  // Optional: link the origin transaction. A link failure is non-fatal — the
  // debt still exists, so we never block creation on it. Cache invalidation
  // happens unconditionally below (an early return here would skip it).
  if (p.origin_transaction_id) {
    await linkTransactionToPersonalDebt(debt.id, p.origin_transaction_id);
  }

  revalidateFinancialViews();
  updateTag("personal-debts");
  return { success: true, data: { id: debt.id } };
}

// ============================================================
// Update
// ============================================================
export async function updatePersonalDebt(
  id: string,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  if (!personalDebtIdSchema.safeParse(id).success) {
    return { success: false, error: "ID inválido" };
  }
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = updatePersonalDebtSchema.safeParse({
    principal_amount: formData.get("principal_amount") || undefined,
    due_date: formData.get("due_date") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.principal_amount != null) patch.principal_amount = parsed.data.principal_amount;
  if (parsed.data.due_date != null) patch.due_date = parsed.data.due_date;
  if (parsed.data.notes != null) patch.notes = parsed.data.notes;

  const { error } = await supabase
    .from("personal_debts")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { success: false, error: "Error al actualizar la deuda" };

  // Principal changes shift outstanding_amount (= principal − repayments)
  // and can settle/reopen the debt — recompute instead of waiting for the
  // next repayment event.
  if (patch.principal_amount != null) {
    await recomputeOutstanding(supabase, user.id, id, patch.principal_amount as number);
  }

  updateTag("personal-debts");
  return { success: true, data: undefined };
}

// ============================================================
// Cancel / Settle
// ============================================================
export async function cancelPersonalDebt(id: string): Promise<ActionResult<undefined>> {
  if (!personalDebtIdSchema.safeParse(id).success) {
    return { success: false, error: "ID inválido" };
  }
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("personal_debts")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("user_id", user.id)
    .in("status", ["active", "settled"])
    .select("id");
  if (error) return { success: false, error: "Error al cancelar la deuda" };
  if (!data || data.length === 0) return { success: false, error: "Deuda no encontrada" };

  revalidateFinancialViews();
  updateTag("personal-debts");
  return { success: true, data: undefined };
}

// ============================================================
// Delete (hard) — removes the debt record entirely. Linked transactions are
// auto-unlinked via FK (transactions.personal_debt_id ON DELETE SET NULL); they
// remain as regular transactions.
// ============================================================
export async function deletePersonalDebt(id: string): Promise<ActionResult<undefined>> {
  if (!personalDebtIdSchema.safeParse(id).success) {
    return { success: false, error: "ID inválido" };
  }
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("personal_debts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");
  if (error) return { success: false, error: "Error al eliminar la deuda" };
  if (!data || data.length === 0) return { success: false, error: "Deuda no encontrada" };

  revalidateFinancialViews();
  updateTag("personal-debts");
  return { success: true, data: undefined };
}

export async function settlePersonalDebt(id: string): Promise<ActionResult<undefined>> {
  if (!personalDebtIdSchema.safeParse(id).success) {
    return { success: false, error: "ID inválido" };
  }
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("personal_debts")
    .update({ status: "settled", outstanding_amount: 0 })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .select("id");
  if (error) return { success: false, error: "Error al saldar la deuda" };
  if (!data || data.length === 0) return { success: false, error: "Deuda no encontrada" };

  updateTag("personal-debts");
  return { success: true, data: undefined };
}

// ============================================================
// Link / Unlink existing transaction (the "Vincular a persona" path)
// Role is auto-inferred from debt.direction + tx.direction. <=1 origin per debt.
// ============================================================
export async function linkTransactionToPersonalDebt(
  personalDebtId: string,
  transactionId: string,
): Promise<ActionResult<undefined>> {
  if (!UUID_RE.test(personalDebtId) || !UUID_RE.test(transactionId)) {
    return { success: false, error: "ID inválido" };
  }
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: debt, error: debtErr } = await supabase
    .from("personal_debts")
    .select("id, direction, principal_amount, origin_transaction_id")
    .eq("id", personalDebtId)
    .eq("user_id", user.id)
    .single();
  if (debtErr || !debt) return { success: false, error: "Deuda no encontrada" };

  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .select("id, direction, amount, personal_debt_id")
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .single();
  if (txErr || !tx) return { success: false, error: "Transacción no encontrada" };
  if (tx.personal_debt_id) {
    return { success: false, error: "Esta transacción ya está vinculada a una persona." };
  }

  const role = inferPersonalDebtRole(
    debt.direction as PersonalDebtDirection,
    tx.direction as "INFLOW" | "OUTFLOW",
  );
  if (role === "origin" && debt.origin_transaction_id) {
    return { success: false, error: "Esta deuda ya tiene una transacción de origen." };
  }

  const { error: updErr } = await supabase
    .from("transactions")
    .update({ personal_debt_id: personalDebtId, pd_role: role })
    .eq("id", transactionId)
    .eq("user_id", user.id);
  if (updErr) return { success: false, error: "Error al vincular la transacción" };

  if (role === "origin") {
    const { error: originErr } = await supabase
      .from("personal_debts")
      .update({ origin_transaction_id: transactionId })
      .eq("id", personalDebtId)
      .eq("user_id", user.id);
    if (originErr) return { success: false, error: "Error al vincular el origen" };
  } else {
    await recomputeOutstanding(supabase, user.id, personalDebtId, debt.principal_amount);
  }

  revalidateFinancialViews();
  updateTag("personal-debts");
  return { success: true, data: undefined };
}

export async function unlinkTransactionFromPersonalDebt(
  transactionId: string,
): Promise<ActionResult<undefined>> {
  if (!UUID_RE.test(transactionId)) return { success: false, error: "ID inválido" };
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .select("id, personal_debt_id, pd_role")
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .single();
  if (txErr || !tx || !tx.personal_debt_id) {
    return { success: false, error: "Transacción no vinculada" };
  }
  const debtId = tx.personal_debt_id as string;
  const wasOrigin = tx.pd_role === "origin";

  const { error: updErr } = await supabase
    .from("transactions")
    .update({ personal_debt_id: null, pd_role: null })
    .eq("id", transactionId)
    .eq("user_id", user.id);
  if (updErr) return { success: false, error: "Error al desvincular la transacción" };

  const { data: debt } = await supabase
    .from("personal_debts")
    .select("principal_amount")
    .eq("id", debtId)
    .eq("user_id", user.id)
    .single();

  if (wasOrigin) {
    const { error: originErr } = await supabase
      .from("personal_debts")
      .update({ origin_transaction_id: null })
      .eq("id", debtId)
      .eq("user_id", user.id);
    if (originErr) return { success: false, error: "Error al desvincular el origen" };
  } else if (debt) {
    await recomputeOutstanding(supabase, user.id, debtId, debt.principal_amount);
  }

  revalidateFinancialViews();
  updateTag("personal-debts");
  return { success: true, data: undefined };
}

// ============================================================
// Record a repayment: creates a linked transaction + recomputes outstanding.
// ============================================================
export async function recordRepayment(
  personalDebtId: string,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  if (!personalDebtIdSchema.safeParse(personalDebtId).success) {
    return { success: false, error: "ID inválido" };
  }
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = recordRepaymentSchema.safeParse({
    amount: formData.get("amount"),
    transaction_date: formData.get("transaction_date"),
    account_id: formData.get("account_id"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const r = parsed.data;

  const { data: debt, error: debtErr } = await supabase
    .from("personal_debts")
    .select("id, direction, principal_amount, currency_code, destinatario_id")
    .eq("id", personalDebtId)
    .eq("user_id", user.id)
    .single();
  if (debtErr || !debt) return { success: false, error: "Deuda no encontrada" };

  // A repayment moves the opposite way to the origin: borrowed -> OUTFLOW, lent -> INFLOW.
  const direction: "INFLOW" | "OUTFLOW" = debt.direction === "borrowed" ? "OUTFLOW" : "INFLOW";
  const rawDescription = r.notes ?? "Abono persona";

  const idempotencyKey = await computeIdempotencyKey({
    provider: "MANUAL",
    // Scope the key to THIS debt: same-day equal repayments to DIFFERENT
    // people are legitimate, not duplicates. Double-submit on the same debt
    // still dedupes.
    providerTransactionId: `personal-debt:${personalDebtId}`,
    transactionDate: r.transaction_date,
    amount: r.amount,
    rawDescription,
  });

  const { data: inserted, error: insErr } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      account_id: r.account_id,
      amount: r.amount,
      direction,
      // personal_debts.currency_code is plain text; the transactions insert
      // wants the currency_code enum. The stored values are always valid codes.
      currency_code: debt.currency_code as Database["public"]["Enums"]["currency_code"],
      transaction_date: r.transaction_date,
      raw_description: rawDescription,
      destinatario_id: debt.destinatario_id,
      provider: "MANUAL",
      capture_method: "MANUAL_FORM",
      idempotency_key: idempotencyKey,
      personal_debt_id: personalDebtId,
      pd_role: "repayment",
    })
    .select("id, account_id, amount, direction, is_excluded")
    .single();
  if (insErr || !inserted) {
    if (insErr?.code === "23505") {
      return { success: false, error: "Este abono ya existe (duplicado)" };
    }
    return { success: false, error: "Error al registrar el abono" };
  }

  // The transactions view types mark columns nullable; the row we just inserted
  // always has these set. Narrow them for the balance math below.
  if (
    inserted.account_id == null ||
    inserted.amount == null ||
    inserted.direction == null
  ) {
    return { success: false, error: "Error al registrar el abono" };
  }

  // Mirror the canonical insert path (persistTransaction →
  // adjustBalancesForTransactionChanges in transactions.ts): a logged repayment
  // MUST move the account balance, or the balance silently drifts. Apply the
  // delta with the SAME shared helper the transaction insert path uses.
  // applyAccountBalanceDelta is debt-account-aware: an INFLOW repayment into a
  // CREDIT_CARD/LOAN reduces the debt balance (a payment, not income), and a
  // normal OUTFLOW repayment from a CHECKING/SAVINGS account reduces cash — the
  // helper handles both via isDebtAccountType internally, so no extra branching
  // is needed here.
  if (!inserted.is_excluded) {
    const { data: acct, error: acctErr } = await supabase
      .from("accounts")
      .select("id, account_type, current_balance")
      .eq("id", inserted.account_id)
      .eq("user_id", user.id)
      .single();
    if (acctErr || !acct || acct.account_type == null) {
      return { success: false, error: "Cuenta no encontrada para aplicar balance" };
    }
    const nextBalance = applyAccountBalanceDelta({
      currentBalance: acct.current_balance ?? 0,
      accountType: acct.account_type,
      direction: inserted.direction,
      amount: inserted.amount,
    });
    const { error: balErr } = await supabase
      .from("accounts")
      .update({ current_balance: nextBalance })
      .eq("id", inserted.account_id)
      .eq("user_id", user.id);
    if (balErr) return { success: false, error: "Error al actualizar el saldo de la cuenta" };
  }

  await recomputeOutstanding(supabase, user.id, personalDebtId, debt.principal_amount);

  revalidateFinancialViews();
  updateTag("personal-debts");
  return { success: true, data: undefined };
}

// ============================================================
// Internal: recompute outstanding_amount + auto-settle.
// ============================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function recomputeOutstanding(
  supabase: any,
  userId: string,
  personalDebtId: string,
  principal: number,
): Promise<void> {
  const { data: repayments } = await supabase
    .from("transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("personal_debt_id", personalDebtId)
    .eq("pd_role", "repayment");
  const amounts: number[] = (repayments ?? []).map((t: { amount: number }) => t.amount);
  const { outstanding, status } = computeOutstanding(principal, amounts);
  const { error: updateErr } = await supabase
    .from("personal_debts")
    .update({ outstanding_amount: outstanding, status })
    .eq("id", personalDebtId)
    .eq("user_id", userId)
    .neq("status", "cancelled");
  // Surface a failed recompute instead of silently returning success with a
  // stale outstanding — better a thrown mutation error the user can retry
  // (inserts are idempotent) than a false success with drifted state.
  if (updateErr) throw updateErr;
}
