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
  recomputeOutstanding,
  recomputeSplitRepaid,
  detachTransactionFromDebt,
} from "@/lib/personal-debts/recompute";
import { inferPersonalDebtRole, isPersonalDebtOverdue } from "@zeta/shared";
import { toColombiaDateString } from "@/lib/utils/date";
import type { ActionResult } from "@/types/actions";
import type { Database } from "@/types/database";
import type {
  PersonalDebtWithDetails,
  PersonalDebtDirection,
} from "@/types/domain";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// System income subcategory "Devolución de préstamos" (seeded in
// 20260701120000_add_loan_repayment_income_category.sql). Stamped on `lent`
// repayment INFLOWs so returned loans are categorized, not counted as salary.
const LOAN_REPAYMENT_CATEGORY_ID = "c0000001-0008-4000-8000-000000000005";

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

  // split_group_id MUST be selected: personas-root filters `!d.split_group_id`
  // to keep shared-payment debts out of the standalone Debo / Me deben lists
  // (they render as grouped SharedPaymentCards instead). Omitting it makes that
  // filter a silent no-op, so every per-transaction shared debt leaks into the
  // flat lists — one card per shared expense.
  const { data, error } = await supabase
    .from("personal_debts")
    .select(`
      id, user_id, destinatario_id, direction, principal_amount,
      currency_code, outstanding_amount, opened_on, due_date, status,
      origin_transaction_id, split_group_id, notes, is_demo, created_at, updated_at,
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
/** One row per currency present in the debts — never a cross-currency sum. */
export interface PersonalDebtCurrencyTotal {
  currency_code: string;
  total: number;
}

export interface PersonalDebtsOverview {
  iOwe: {
    totals: PersonalDebtCurrencyTotal[];
    byPerson: { destinatario_name: string; amount: number; currency_code: string }[];
  };
  owedToMe: {
    totals: PersonalDebtCurrencyTotal[];
    byPerson: { destinatario_name: string; amount: number; currency_code: string }[];
  };
  overdue: {
    destinatario_name: string;
    amount: number;
    currency_code: string;
    due_date: string;
  }[];
}

export async function getPersonalDebtsOverview(): Promise<ActionResult<PersonalDebtsOverview>> {
  const res = await getPersonalDebts();
  if (!res.success) return res;
  const active = res.data.filter((d) => d.status === "active");
  const iOwe = active.filter((d) => d.direction === "borrowed");
  const owedToMe = active.filter((d) => d.direction === "lent");
  // Group by currency instead of one flat sum: adding a USD loan to a COP one
  // and printing the result as COP is a made-up number.
  const totalsByCurrency = (xs: PersonalDebtWithDetails[]) => {
    const byCode = new Map<string, number>();
    for (const d of xs) {
      byCode.set(d.currency_code, (byCode.get(d.currency_code) ?? 0) + d.outstanding_amount);
    }
    return [...byCode.entries()]
      .map(([currency_code, total]) => ({ currency_code, total }))
      .sort((a, b) => a.currency_code.localeCompare(b.currency_code));
  };
  return {
    success: true,
    data: {
      iOwe: {
        totals: totalsByCurrency(iOwe),
        byPerson: iOwe.map((d) => ({ destinatario_name: d.destinatario_name, amount: d.outstanding_amount, currency_code: d.currency_code })),
      },
      owedToMe: {
        totals: totalsByCurrency(owedToMe),
        byPerson: owedToMe.map((d) => ({ destinatario_name: d.destinatario_name, amount: d.outstanding_amount, currency_code: d.currency_code })),
      },
      overdue: active
        .filter((d) => d.is_overdue)
        .map((d) => ({
          destinatario_name: d.destinatario_name,
          amount: d.outstanding_amount,
          currency_code: d.currency_code,
          due_date: d.due_date!,
        })),
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

  const { data: existing, error: existingErr } = await supabase
    .from("personal_debts")
    .select("id, split_group_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (existingErr || !existing) return { success: false, error: "Deuda no encontrada" };

  // A shared payment's shares are derived from the split — letting one
  // participant's principal drift would break the group's arithmetic. The edit
  // sheet hides the field; enforce it here too since the action is callable.
  if (parsed.data.principal_amount != null && existing.split_group_id) {
    return {
      success: false,
      error: "El monto de una deuda de pago compartido se edita desde el gasto repartido.",
    };
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
    try {
      // Explicitly raising the amount is a decision to reopen a settled debt.
      await recomputeOutstanding(supabase, user.id, id, patch.principal_amount as number, {
        allowReopen: true,
      });
    } catch (e) {
      revalidateFinancialViews();
      const detail = e instanceof Error ? e.message : String(e);
      return {
        success: false,
        error: `Deuda actualizada, pero no se pudo recalcular el saldo: ${detail}`,
      };
    }
  }

  // A changed principal moves outstanding, which feeds the dashboard, the
  // attention card and /deudas — not just the personas list.
  revalidateFinancialViews();
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
    .select("id, split_group_id");
  if (error) return { success: false, error: "Error al cancelar la deuda" };
  if (!data || data.length === 0) return { success: false, error: "Deuda no encontrada" };

  // Cancelling a settled share un-credits it (only what was actually paid
  // still counts), so the group's recovered total has to follow.
  const splitGroupId = data[0].split_group_id;
  if (splitGroupId) {
    try {
      await recomputeSplitRepaid(supabase, user.id, splitGroupId);
    } catch (e) {
      revalidateFinancialViews();
      const detail = e instanceof Error ? e.message : String(e);
      return {
        success: false,
        error: `Deuda cancelada, pero no se pudo actualizar el pago compartido: ${detail}`,
      };
    }
  }

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
    .select("id, split_group_id");
  if (error) return { success: false, error: "Error al eliminar la deuda" };
  if (!data || data.length === 0) return { success: false, error: "Deuda no encontrada" };

  // Removing one participant changes both what the group owes and what it has
  // recovered; without this the origin tx keeps crediting a debt that is gone.
  const splitGroupId = data[0].split_group_id;
  if (splitGroupId) {
    try {
      await recomputeSplitRepaid(supabase, user.id, splitGroupId);
    } catch (e) {
      revalidateFinancialViews();
      const detail = e instanceof Error ? e.message : String(e);
      return {
        success: false,
        error: `Deuda eliminada, pero no se pudo actualizar el pago compartido: ${detail}`,
      };
    }
  }

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
    .select("id, split_group_id");
  if (error) return { success: false, error: "Error al saldar la deuda" };
  if (!data || data.length === 0) return { success: false, error: "Deuda no encontrada" };

  // Settling a participant's share resolves it, so the shared payment's
  // recovered total (and the origin tx's effective spend) must move with it —
  // otherwise the card stays at "Recuperado $0" after settling everyone.
  const splitGroupId = data[0].split_group_id;
  if (splitGroupId) {
    try {
      await recomputeSplitRepaid(supabase, user.id, splitGroupId);
    } catch (e) {
      revalidateFinancialViews();
      const detail = e instanceof Error ? e.message : String(e);
      return {
        success: false,
        error: `Deuda saldada, pero no se pudo actualizar el pago compartido: ${detail}`,
      };
    }
  }

  revalidateFinancialViews();
  updateTag("personal-debts");
  return { success: true, data: undefined };
}

// ============================================================
// Reopen / undo settle: settled|cancelled -> active, restoring the outstanding
// from principal − repayments. principal_amount is preserved on settle, so the
// original balance is recoverable. For a shared-payment participant this also
// un-credits its share (a settled share counts as recovered), so the group's
// repaid total has to come back down.
// ============================================================
export async function reopenPersonalDebt(id: string): Promise<ActionResult<undefined>> {
  if (!personalDebtIdSchema.safeParse(id).success) {
    return { success: false, error: "ID inválido" };
  }
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: debt, error: debtErr } = await supabase
    .from("personal_debts")
    .select("id, principal_amount, split_group_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .in("status", ["settled", "cancelled"])
    .single();
  if (debtErr || !debt) return { success: false, error: "Deuda no encontrada o ya activa" };

  // Set active first so recomputeOutstanding (which skips cancelled rows) runs.
  const { error: updErr } = await supabase
    .from("personal_debts")
    .update({ status: "active" })
    .eq("id", id)
    .eq("user_id", user.id);
  if (updErr) return { success: false, error: "Error al reabrir la deuda" };

  try {
    await recomputeOutstanding(supabase, user.id, id, debt.principal_amount);
    if (debt.split_group_id) {
      await recomputeSplitRepaid(supabase, user.id, debt.split_group_id);
    }
  } catch (e) {
    revalidateFinancialViews();
    const detail = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      error: `Deuda reabierta, pero no se pudo recalcular el saldo: ${detail}`,
    };
  }

  revalidateFinancialViews();
  updateTag("personal-debts");
  return { success: true, data: undefined };
}

// ============================================================
// Link / Unlink existing transaction (the "Vincular a persona" path)
// Role is auto-inferred from debt.direction + tx.direction.
// origin_transaction_id stays the FIRST origin (canonical); further
// origin-role links are additional disbursements from the same person and
// INCREASE principal_amount by the tx amount (so one debt per person can
// absorb several loans instead of forcing a new debt per loan). Shared-payment
// debts keep the <=1-origin rule — their origin is the split transaction.
// ============================================================
export interface LinkToPersonalDebtResult {
  role: "origin" | "repayment";
  /** True when the link was an additional loan that increased the debt's principal. */
  principalIncreased: boolean;
}

export async function linkTransactionToPersonalDebt(
  personalDebtId: string,
  transactionId: string,
): Promise<ActionResult<LinkToPersonalDebtResult>> {
  if (!UUID_RE.test(personalDebtId) || !UUID_RE.test(transactionId)) {
    return { success: false, error: "ID inválido" };
  }
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: debt, error: debtErr } = await supabase
    .from("personal_debts")
    .select(
      "id, direction, status, principal_amount, currency_code, origin_transaction_id, split_group_id",
    )
    .eq("id", personalDebtId)
    .eq("user_id", user.id)
    .single();
  if (debtErr || !debt) return { success: false, error: "Deuda no encontrada" };
  if (debt.status === "cancelled") {
    return { success: false, error: "No puedes vincular movimientos a una deuda cancelada." };
  }

  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .select(
      "id, direction, amount, currency_code, personal_debt_id, split_group_id, reconciled_into_transaction_id",
    )
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .single();
  if (txErr || !tx) return { success: false, error: "Transacción no encontrada" };
  if (tx.personal_debt_id) {
    return { success: false, error: "Esta transacción ya está vinculada a una persona." };
  }
  // A shared-payment origin or a reconciled duplicate must not feed a debt's
  // math — their amounts already live elsewhere.
  if (tx.split_group_id) {
    return { success: false, error: "Esta transacción pertenece a un pago compartido." };
  }
  if (tx.reconciled_into_transaction_id) {
    return { success: false, error: "Esta transacción fue conciliada con otro movimiento." };
  }
  if ((tx.currency_code ?? "COP") !== debt.currency_code) {
    return {
      success: false,
      error: `La moneda del movimiento (${tx.currency_code ?? "COP"}) no coincide con la de la deuda (${debt.currency_code}).`,
    };
  }

  const role = inferPersonalDebtRole(
    debt.direction as PersonalDebtDirection,
    tx.direction as "INFLOW" | "OUTFLOW",
  );
  // "Additional" = the debt already has at least one origin-role transaction.
  // Checked by pointer AND by pd_role rows: after a canonical-origin unlink the
  // pointer is null but linked origins remain, and treating the next origin
  // link as canonical would silently drop its amount from the principal.
  let isAdditionalOrigin = false;
  if (role === "origin") {
    if (debt.origin_transaction_id != null) {
      isAdditionalOrigin = true;
    } else {
      const { count, error: cntErr } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("personal_debt_id", personalDebtId)
        .eq("pd_role", "origin");
      if (cntErr) return { success: false, error: "Error al vincular la transacción" };
      isAdditionalOrigin = (count ?? 0) > 0;
    }
  }
  // A shared payment's origin IS the split transaction — adding disbursements
  // would corrupt the participants' shares, so keep the single-origin rule there.
  if (isAdditionalOrigin && debt.split_group_id) {
    return {
      success: false,
      error:
        "Esta deuda es parte de un pago compartido y ya tiene su transacción de origen. Crea una deuda aparte para este monto.",
    };
  }

  const { error: updErr } = await supabase
    .from("transactions")
    .update({ personal_debt_id: personalDebtId, pd_role: role })
    .eq("id", transactionId)
    .eq("user_id", user.id);
  if (updErr) return { success: false, error: "Error al vincular la transacción" };

  // Past this point the link is already committed — every failure path must
  // still invalidate caches, or the UI keeps serving the pre-link state and a
  // retry dies on "ya está vinculada".
  try {
    if (isAdditionalOrigin) {
      // Additional loan from the same person: grow the debt instead of failing.
      // Recompute (not a blind write) so outstanding/status follow the new
      // principal — this also reactivates a settled debt that gets a new loan.
      const newPrincipal = Number(debt.principal_amount) + Number(tx.amount ?? 0);
      const { error: princErr } = await supabase
        .from("personal_debts")
        .update({ principal_amount: newPrincipal })
        .eq("id", personalDebtId)
        .eq("user_id", user.id)
        .neq("status", "cancelled");
      if (princErr) throw new Error("Error al aumentar la deuda");
      // A new loan genuinely reopens a settled debt — the one case where
      // recomputing over a settled row is intended.
      await recomputeOutstanding(supabase, user.id, personalDebtId, newPrincipal, {
        allowReopen: true,
      });
    } else if (role === "origin") {
      const { error: originErr } = await supabase
        .from("personal_debts")
        .update({ origin_transaction_id: transactionId })
        .eq("id", personalDebtId)
        .eq("user_id", user.id);
      if (originErr) throw new Error("Error al vincular el origen");
    } else {
      await recomputeOutstanding(supabase, user.id, personalDebtId, debt.principal_amount);
      // Linking an incoming transfer as a repayment of a shared-payment debt must
      // also lower the origin transaction's effective spend — otherwise the debt
      // settles but the "Pago compartido" stays at "Recuperado $0".
      if (debt.split_group_id) {
        await recomputeSplitRepaid(supabase, user.id, debt.split_group_id);
      }
    }
  } catch (e) {
    revalidateFinancialViews();
    updateTag("personal-debts");
    return {
      success: false,
      error: e instanceof Error ? e.message : "Error al actualizar la deuda",
    };
  }

  revalidateFinancialViews();
  updateTag("personal-debts");
  return { success: true, data: { role, principalIncreased: isAdditionalOrigin } };
}

// ============================================================
// Candidate transactions to link as a repayment of a debt (the "Vincular
// movimiento existente" mode of the Registrar-pago dialog). A repayment moves
// opposite to the origin: lent -> INFLOW, borrowed -> OUTFLOW. Only unlinked,
// non-excluded, non-reconciled rows from the last ~90 days.
// ============================================================
export interface LinkableTransaction {
  id: string;
  description: string;
  amount: number;
  transaction_date: string;
  currency_code: string;
}

export async function getLinkableRepaymentTransactions(
  personalDebtId: string,
): Promise<ActionResult<LinkableTransaction[]>> {
  if (!personalDebtIdSchema.safeParse(personalDebtId).success) {
    return { success: false, error: "ID inválido" };
  }
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: debt, error: debtErr } = await supabase
    .from("personal_debts")
    .select("direction, currency_code")
    .eq("id", personalDebtId)
    .eq("user_id", user.id)
    .single();
  if (debtErr || !debt) return { success: false, error: "Deuda no encontrada" };

  const direction: "INFLOW" | "OUTFLOW" = debt.direction === "borrowed" ? "OUTFLOW" : "INFLOW";
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const { data, error } = await supabase
    .from("transactions")
    .select("id, amount, transaction_date, merchant_name, clean_description, raw_description, currency_code")
    .eq("user_id", user.id)
    // Cross-currency repayments corrupt the outstanding math (and the link
    // action rejects them) — only offer same-currency movements.
    .eq("currency_code", debt.currency_code as Database["public"]["Enums"]["currency_code"])
    .eq("direction", direction)
    .is("personal_debt_id", null)
    .is("split_group_id", null)
    .eq("is_excluded", false)
    .is("reconciled_into_transaction_id", null)
    .gte("transaction_date", toColombiaDateString(since))
    .order("transaction_date", { ascending: false })
    .limit(30);
  if (error) return { success: false, error: "Error al cargar los movimientos" };

  const rows: LinkableTransaction[] = (data ?? []).map((t) => ({
    id: t.id,
    description: t.merchant_name || t.clean_description || t.raw_description || "Movimiento",
    amount: Number(t.amount ?? 0),
    transaction_date: t.transaction_date,
    currency_code: t.currency_code ?? "COP",
  }));
  return { success: true, data: rows };
}

export async function unlinkTransactionFromPersonalDebt(
  transactionId: string,
): Promise<ActionResult<undefined>> {
  if (!UUID_RE.test(transactionId)) return { success: false, error: "ID inválido" };
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .select("id, amount, personal_debt_id, pd_role")
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .single();
  if (txErr || !tx || !tx.personal_debt_id) {
    return { success: false, error: "Transacción no vinculada" };
  }
  const debtId = tx.personal_debt_id as string;

  // Existence check BEFORE mutating: if the debt row can't be read the unlink
  // must abort up-front instead of committing and failing bookkeeping later.
  const { data: debt, error: debtErr } = await supabase
    .from("personal_debts")
    .select("id")
    .eq("id", debtId)
    .eq("user_id", user.id)
    .single();
  if (debtErr || !debt) return { success: false, error: "Deuda no encontrada" };

  const { error: updErr } = await supabase
    .from("transactions")
    .update({ personal_debt_id: null, pd_role: null })
    .eq("id", transactionId)
    .eq("user_id", user.id);
  if (updErr) return { success: false, error: "Error al desvincular la transacción" };

  // Past this point the unlink is already committed — failure paths must still
  // invalidate caches so the UI reflects the detached transaction.
  try {
    await detachTransactionFromDebt(supabase, user.id, {
      id: transactionId,
      amount: tx.amount,
      personal_debt_id: debtId,
      pd_role: tx.pd_role as "origin" | "repayment" | null,
    });
  } catch (e) {
    revalidateFinancialViews();
    updateTag("personal-debts");
    return {
      success: false,
      error: e instanceof Error ? e.message : "Error al actualizar la deuda",
    };
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
    .select("id, direction, principal_amount, currency_code, destinatario_id, split_group_id")
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
      // A repaid `lent` debt is money coming back from a loan — tag it with the
      // dedicated income subcategory so it doesn't land uncategorized (nor get
      // mistaken for salary/bonus). Borrowed repayments are OUTFLOWs (you paying
      // back) and get no income category.
      category_id: debt.direction === "lent" ? LOAN_REPAYMENT_CATEGORY_ID : null,
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

  // The transaction and the account balance are already committed, so a failed
  // recompute must not escape as a thrown error with no invalidation — the UI
  // would keep the pre-insert state while the balance had already moved, and
  // the retry would die on the idempotency key.
  try {
    await recomputeOutstanding(supabase, user.id, personalDebtId, debt.principal_amount);

    // Shared payment ("Pago compartido"): a repayment lowers the origin
    // transaction's effective spend (amount − split_repaid_amount). Recompute the
    // group's repaid total so dashboards reflect it.
    if (debt.split_group_id) {
      await recomputeSplitRepaid(supabase, user.id, debt.split_group_id);
    }
  } catch (e) {
    revalidateFinancialViews();
    updateTag("personal-debts");
    const detail = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      error: `Abono registrado, pero no se pudo recalcular la deuda: ${detail}`,
    };
  }

  revalidateFinancialViews();
  updateTag("personal-debts");
  return { success: true, data: undefined };
}
