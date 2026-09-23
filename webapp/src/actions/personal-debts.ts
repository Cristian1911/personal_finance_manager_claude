"use server";
import { z } from "zod";
import { cacheTag, cacheLife, updateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { revalidateFinancialViews } from "@/lib/cache/revalidation";
import {
  personalDebtIdSchema,
  createPersonalDebtSchema,
  updatePersonalDebtSchema,
  recordRepaymentSchema,
  splitPersonalDebtSchema,
} from "@/lib/validators/personal-debt";
import { computeIdempotencyKey } from "@/lib/utils/idempotency";
import { applyAccountBalanceDelta } from "@/lib/utils/account-balance";
import {
  recomputeOutstanding,
  recomputeSplitRepaid,
  recomputeDebts,
  detachTransactionFromDebt,
  readAllocatedDebtIds,
} from "@/lib/personal-debts/recompute";
import {
  resolveSplitParticipants,
  cleanupAdHocDestinatarios,
} from "@/lib/personal-debts/ad-hoc";
import { SPLIT_ERROR_MESSAGES } from "@/lib/personal-debts/split-errors";
import { readRepaidByDebt } from "@/lib/personal-debts/repaid";
import {
  allocatePaymentAcrossDebts,
  buildPersonHierarchy,
  type DebtOriginTx,
  type HierarchyModo,
  type PersonDebtSummary,
} from "@/lib/personal-debts/hierarchy";
import {
  computeSplit,
  getCurrencyDecimals,
  inferPersonalDebtRole,
  isPersonalDebtOverdue,
} from "@zeta/shared";
import { toColombiaDateString } from "@/lib/utils/date";
import { formatCurrency } from "@/lib/utils/currency";
import type { ActionResult } from "@/types/actions";
import type { Database } from "@/types/database";
import type {
  CurrencyCode,
  PersonalDebtWithDetails,
  PersonalDebtDirection,
} from "@/types/domain";

type PersonalDebtInsert = Database["public"]["Tables"]["personal_debts"]["Insert"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// System income subcategory "Devolución de préstamos" (seeded in
// 20260701120000_add_loan_repayment_income_category.sql). Stamped on `lent`
// repayment INFLOWs so returned loans are categorized, not counted as salary.
const LOAN_REPAYMENT_CATEGORY_ID = "c0000001-0008-4000-8000-000000000005";

/** Max ids per `.in()` filter (PostgREST puts them on the URL). */
const ORIGIN_ID_CHUNK = 150;

// ============================================================
// Persona → viaje → deudas (the Deudas personales page)
// ============================================================
async function getPersonalDebtsByPersonCached(
  accessToken: string,
  userId: string,
  primaryCurrency: string,
): Promise<PersonDebtSummary[]> {
  "use cache";
  // Grouping depends on the origin transactions' tags and on the viajes those
  // tags belong to, so a retag or a trip rename must drop this too.
  cacheTag("personal-debts");
  cacheTag("modos");
  cacheTag("tags");
  cacheTag("transactions");
  cacheLife("zeta");
  const supabase = createCachedClient(accessToken);

  const [{ data, error }, repaidByDebt] = await Promise.all([
    supabase
      .from("personal_debts")
      .select(`
        id, user_id, destinatario_id, direction, principal_amount,
        currency_code, outstanding_amount, opened_on, due_date, status,
        origin_transaction_id, split_group_id, notes, is_demo, created_at, updated_at,
        installment_group_id, installment_total, group_total_amount, interest_amount,
        destinatario:destinatarios!personal_debts_destinatario_id_fkey ( name, default_category_id, is_ad_hoc )
      `)
      .eq("user_id", userId),
    readRepaidByDebt(supabase, userId),
  ]);
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const today = toColombiaDateString(new Date());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const debts: PersonalDebtWithDetails[] = data.map((row: any) => {
    const total_repaid = repaidByDebt.get(row.id) ?? 0;
    return {
      ...row,
      destinatario_name: row.destinatario?.name ?? "—",
      destinatario_default_category_id: row.destinatario?.default_category_id ?? null,
      destinatario_is_ad_hoc: !!row.destinatario?.is_ad_hoc,
      total_repaid,
      is_overdue: isPersonalDebtOverdue(row.due_date, row.status, today),
    };
  });

  const originIds = [
    ...new Set(debts.map((d) => d.origin_transaction_id).filter((x): x is string => !!x)),
  ];
  // `.in()` goes on the GET URL: chunk it so a long history of shared
  // expenses never pushes the request past proxy limits.
  const chunks: string[][] = [];
  for (let i = 0; i < originIds.length; i += ORIGIN_ID_CHUNK) {
    chunks.push(originIds.slice(i, i + ORIGIN_ID_CHUNK));
  }
  const [originTxs, tagRows, { data: modos, error: modosErr }] = await Promise.all([
    Promise.all(
      chunks.map(async (ids) => {
        const { data, error: e } = await supabase
          .from("transactions")
          .select(
            "id, amount, transaction_date, merchant_name, clean_description, raw_description, account_id, split_group_id, installment_current, installment_total",
          )
          .eq("user_id", userId)
          .in("id", ids);
        if (e) throw e;
        return (data ?? []) as DebtOriginTx[];
      }),
    ).then((xs) => xs.flat()),
    Promise.all(
      chunks.map(async (ids) => {
        const { data, error: e } = await supabase
          .from("transaction_tags")
          .select("transaction_id, tag_id")
          .eq("user_id", userId)
          .in("transaction_id", ids);
        if (e) throw e;
        return data ?? [];
      }),
    ).then((xs) => xs.flat()),
    supabase
      .from("modos")
      .select("id, name, emoji, color, tag_ids, date_from, date_to")
      .eq("user_id", userId),
  ]);
  if (modosErr) throw modosErr;

  return buildPersonHierarchy(
    { debts, originTxs, tagRows, modos: (modos ?? []) as HierarchyModo[] },
    primaryCurrency,
  );
}

export async function getPersonalDebtsByPerson(
  primaryCurrency: string,
): Promise<ActionResult<PersonDebtSummary[]>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  try {
    const data = await getPersonalDebtsByPersonCached(accessToken, user.id, primaryCurrency);
    return { success: true, data };
  } catch {
    return { success: false, error: "Error al cargar las deudas personales" };
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

  // A share of an abono split across several debts would vanish with the
  // debt (cascade) and that money would count nowhere — unlink it first.
  const { count: allocCount, error: allocErr } = await supabase
    .from("personal_debt_allocations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("personal_debt_id", id);
  if (allocErr) return { success: false, error: "Error al eliminar la deuda" };
  if ((allocCount ?? 0) > 0) {
    return {
      success: false,
      error:
        "Esta deuda recibió parte de un abono repartido entre varias deudas. Desvincula ese abono antes de eliminarla.",
    };
  }

  const { data, error } = await supabase
    .from("personal_debts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, split_group_id, destinatario_id");
  if (error) return { success: false, error: "Error al eliminar la deuda" };
  if (!data || data.length === 0) return { success: false, error: "Deuda no encontrada" };

  // An ad-hoc person only ever existed to back this debt; drop them with it.
  await cleanupAdHocDestinatarios(supabase, user.id, [data[0].destinatario_id]);

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

// ============================================================
// Dividir una deuda existente entre varias personas.
//
// Turns ONE `lent` debt into N sibling debts sharing a fresh split_group_id —
// the "pagué la cuenta y ahora me deben 6 personas" case, when the debt was
// already recorded as a single lump. Participants may be existing contacts or
// ad-hoc typed names (materialized into hidden destinatarios).
//
// The debt's principal IS what others owe, so there is no user share: the whole
// principal is divided among the participants (userIncluded = false). Contrast
// with `createSharedPayment`, which splits a PAYMENT total the user may share in.
//
// If the debt has an origin transaction it is re-tagged into the split group so
// the grouped card reads its real total (and `userShare = total − Σ owed` falls
// out for free). Deleting the original debt clears that tx's personal_debt_id
// via ON DELETE SET NULL — exactly what the shared-payment model requires of an
// origin tx — and we clear the now-meaningless pd_role alongside it.
// ============================================================
export async function splitPersonalDebt(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ split_group_id: string; debt_ids: string[] }>> {
  if (!personalDebtIdSchema.safeParse(id).success) {
    return { success: false, error: "ID inválido" };
  }
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  let participantsRaw: unknown = [];
  try {
    participantsRaw = JSON.parse(String(formData.get("participants") ?? "[]"));
  } catch {
    return { success: false, error: "Datos de personas inválidos" };
  }
  const parsed = splitPersonalDebtSchema.safeParse({
    method: formData.get("method") || "equal",
    participants: participantsRaw,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { data: debt, error: debtErr } = await supabase
    .from("personal_debts")
    .select(
      "id, destinatario_id, direction, principal_amount, currency_code, opened_on, due_date, notes, status, origin_transaction_id, split_group_id, is_demo",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (debtErr || !debt) return { success: false, error: "Deuda no encontrada" };
  if (debt.split_group_id) {
    return { success: false, error: "Esta deuda ya está repartida entre varias personas" };
  }
  if (debt.direction !== "lent") {
    return { success: false, error: "Solo puedes dividir una deuda que te deben" };
  }
  if (debt.status !== "active") {
    return { success: false, error: "Solo puedes dividir una deuda activa" };
  }

  // Existing repayments can't be attributed to any one participant, and the
  // original debt row is about to disappear — so refuse rather than silently
  // losing who paid what.
  // The view also counts this debt's share of abonos split across several debts.
  const { count, error: repErr } = await supabase
    .from("personal_debt_repayment_amounts")
    .select("transaction_id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("personal_debt_id", id);
  if (repErr) return { success: false, error: "Error al revisar los abonos de la deuda" };
  if ((count ?? 0) > 0) {
    return {
      success: false,
      error:
        "Esta deuda ya tiene abonos registrados y no se puede dividir. Elimínala y regístrala como pago compartido.",
    };
  }

  const resolved = await resolveSplitParticipants(supabase, user.id, parsed.data.participants);
  if (!resolved.ok) return { success: false, error: resolved.error };
  const { participants: people, createdIds } = resolved;

  const principal = Number(debt.principal_amount);
  const split = computeSplit({
    total: principal,
    method: parsed.data.method,
    participants: people.map((x) => ({
      destinatario_id: x.destinatario_id,
      value: x.value,
    })),
    userIncluded: false,
    decimals: getCurrencyDecimals(debt.currency_code as CurrencyCode),
  });
  if (!split.ok) {
    await cleanupAdHocDestinatarios(supabase, user.id, createdIds);
    return { success: false, error: SPLIT_ERROR_MESSAGES[split.reason] };
  }

  const splitGroupId = crypto.randomUUID();
  const debtIds: string[] = [];
  const rows: PersonalDebtInsert[] = split.shares.map((share) => {
    const debtId = crypto.randomUUID();
    debtIds.push(debtId);
    return {
      id: debtId,
      user_id: user.id,
      destinatario_id: share.destinatario_id!,
      direction: "lent",
      principal_amount: share.amount,
      outstanding_amount: share.amount,
      currency_code: debt.currency_code,
      opened_on: debt.opened_on,
      due_date: debt.due_date,
      notes: debt.notes,
      status: "active",
      is_demo: debt.is_demo,
      split_group_id: splitGroupId,
      origin_transaction_id: debt.origin_transaction_id,
    };
  });

  // 1) Siblings first — if this fails nothing has been destroyed yet.
  const { error: insErr } = await supabase.from("personal_debts").insert(rows);
  if (insErr) {
    await cleanupAdHocDestinatarios(supabase, user.id, createdIds);
    return { success: false, error: "Error al crear las deudas del reparto" };
  }

  // 2) Replace the original lump. `.select()` is load-bearing: PostgREST reports
  //    error=null for a delete that matched ZERO rows, so without the row-count
  //    check two interleaved splits of the same debt would both "succeed" and
  //    leave 2N siblings — the amount owed silently doubled.
  const { data: deleted, error: delErr } = await supabase
    .from("personal_debts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");
  if (delErr || !deleted || deleted.length === 0) {
    await supabase.from("personal_debts").delete().eq("user_id", user.id).in("id", debtIds);
    await cleanupAdHocDestinatarios(supabase, user.id, createdIds);
    return {
      success: false,
      error: delErr
        ? "Error al reemplazar la deuda original"
        : "Esta deuda ya fue dividida o eliminada",
    };
  }

  // 3) Re-tag the origin transaction, if there was one. Non-fatal: without it
  //    the group still reads correctly (total falls back to Σ principals and
  //    `recovered` is derived from the debts themselves).
  if (debt.origin_transaction_id) {
    const { error: txErr } = await supabase
      .from("transactions")
      .update({ split_group_id: splitGroupId, split_repaid_amount: 0, pd_role: null })
      .eq("id", debt.origin_transaction_id)
      .eq("user_id", user.id)
      // Never steal a tx that already anchors another split group — that would
      // orphan the other group's origin and freeze its recovered total at 0.
      .is("split_group_id", null);
    if (txErr) {
      console.error("splitPersonalDebt: failed to tag origin transaction:", txErr);
    }
  }

  // 4) The lump's counterparty (often a stand-in like "Compañeros") may now be
  //    an unreferenced ad-hoc row.
  await cleanupAdHocDestinatarios(supabase, user.id, [debt.destinatario_id]);

  revalidateFinancialViews();
  updateTag("personal-debts");
  return { success: true, data: { split_group_id: splitGroupId, debt_ids: debtIds } };
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

  // An abono split across several debts: remember which ones before the
  // unlink so every one of them is recomputed, not just the anchor.
  let allocatedDebtIds: string[] = [];
  if (tx.pd_role === "repayment") {
    try {
      allocatedDebtIds = await readAllocatedDebtIds(supabase, user.id, transactionId);
    } catch {
      return { success: false, error: "Error al desvincular la transacción" };
    }
  }

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
      allocatedDebtIds,
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
    .select(
      "id, direction, principal_amount, currency_code, destinatario_id, split_group_id, destinatario:destinatarios!personal_debts_destinatario_id_fkey ( is_ad_hoc )",
    )
    .eq("id", personalDebtId)
    .eq("user_id", user.id)
    .single();
  if (debtErr || !debt) return { success: false, error: "Deuda no encontrada" };

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
    .insert(
      buildRepaymentRow({
        userId: user.id,
        accountId: r.account_id,
        amount: r.amount,
        transactionDate: r.transaction_date,
        rawDescription,
        idempotencyKey,
        debt: {
          id: personalDebtId,
          direction: debt.direction,
          currency_code: debt.currency_code,
          destinatario_id: debt.destinatario_id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          is_ad_hoc: !!(debt as any).destinatario?.is_ad_hoc,
        },
      }),
    )
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

// ============================================================
// Repayment row — one shape for the single and the grouped abono.
// ============================================================
type RepaymentRowInput = {
  userId: string;
  accountId: string;
  amount: number;
  transactionDate: string;
  rawDescription: string;
  idempotencyKey: string;
  debt: {
    id: string;
    direction: PersonalDebtDirection;
    currency_code: string;
    destinatario_id: string;
    is_ad_hoc: boolean;
  };
};

function buildRepaymentRow(
  input: RepaymentRowInput,
): Database["public"]["Tables"]["transactions"]["Insert"] {
  const { debt } = input;
  // A repayment moves the opposite way to the origin: borrowed -> OUTFLOW, lent -> INFLOW.
  const direction: "INFLOW" | "OUTFLOW" = debt.direction === "borrowed" ? "OUTFLOW" : "INFLOW";
  return {
    user_id: input.userId,
    account_id: input.accountId,
    amount: input.amount,
    direction,
    // personal_debts.currency_code is plain text; the transactions insert
    // wants the currency_code enum. The stored values are always valid codes.
    currency_code: debt.currency_code as Database["public"]["Enums"]["currency_code"],
    transaction_date: input.transactionDate,
    raw_description: input.rawDescription,
    // An ad-hoc person is hidden from AppDataProvider, so stamping their id
    // here would leave the transaction pointing at a destinatario the edit
    // form's picker can't resolve (renders blank, and a save would clear it)
    // and would surface the throwaway name in per-destinatario analytics. The
    // repayment is still tied to the person through personal_debt_id.
    destinatario_id: debt.is_ad_hoc ? null : debt.destinatario_id,
    provider: "MANUAL",
    capture_method: "MANUAL_FORM",
    idempotency_key: input.idempotencyKey,
    personal_debt_id: debt.id,
    pd_role: "repayment",
    // A repaid `lent` debt is money coming back from a loan — tag it with the
    // dedicated income subcategory so it doesn't land uncategorized (nor get
    // mistaken for salary/bonus). Borrowed repayments are OUTFLOWs (you paying
    // back) and get no income category.
    category_id: debt.direction === "lent" ? LOAN_REPAYMENT_CATEGORY_ID : null,
    // Settling a debt with a person is neither consumption nor earnings, so
    // both legs are neutral — this is one of the four surfaces that counted a
    // repayment received as income.
    //
    // Set literally rather than through classifyFlow: the counterparty is a
    // person, not an account, so no account_type carries the fact. An INFLOW
    // to a CHECKING account is INCOME by every structural rule the classifier
    // has, and it would be wrong here.
    //
    // Known asymmetry, left as-is deliberately: the ORIGINAL outflow when the
    // money was lent is still classified as SPEND. Netting that out is a
    // separate decision about what a receivable is worth, not part of wiring
    // the write paths.
    flow_class: direction === "OUTFLOW" ? "DEBT_PAYMENT" : "DEBT_CREDIT",
    // NULL version — see the note on FLOW_CLASS_RULES_VERSION. The classifier
    // would call an INFLOW to a CHECKING account INCOME, so a version-keyed
    // backfill would undo exactly the fix this site makes.
    flow_class_version: null,
    source_pattern: null,
  };
}

// ============================================================
// Grouped repayment: ONE payment from a person against several of their
// debts (a whole viaje, or everything they owe). The schema ties a
// transaction to exactly one debt, so the amount is spread oldest-first and
// one repayment row lands per debt it reaches — same rows, same balance
// effect, same recompute as N single abonos, in one confirmation.
// ============================================================
const groupedRepaymentIdsSchema = z
  .array(personalDebtIdSchema)
  .min(1, "Elige al menos una deuda")
  .max(200, "Son demasiadas deudas para un solo abono");

export async function recordGroupedRepayment(
  debtIds: string[],
  formData: FormData,
): Promise<ActionResult<{ transactions: number; skipped: number }>> {
  const idsParsed = groupedRepaymentIdsSchema.safeParse(debtIds);
  if (!idsParsed.success) return { success: false, error: idsParsed.error.issues[0].message };
  const ids = [...new Set(idsParsed.data)];

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

  const { data: debts, error: debtsErr } = await supabase
    .from("personal_debts")
    .select(
      "id, direction, status, principal_amount, outstanding_amount, currency_code, destinatario_id, split_group_id, opened_on, created_at, destinatario:destinatarios!personal_debts_destinatario_id_fkey ( name, is_ad_hoc )",
    )
    .eq("user_id", user.id)
    .in("id", ids);
  if (debtsErr || !debts || debts.length !== ids.length) {
    return { success: false, error: "Alguna de las deudas no existe" };
  }
  const active = debts.filter((d) => d.status === "active");
  if (active.length === 0) return { success: false, error: "No hay deudas activas para abonar" };
  if (active.length !== debts.length) {
    return { success: false, error: "Alguna de las deudas ya no está activa. Recarga la página." };
  }
  const first = active[0];
  if (active.some((d) => d.direction !== first.direction)) {
    return { success: false, error: "No se puede mezclar lo que debes con lo que te deben en un solo abono" };
  }
  if (active.some((d) => d.currency_code !== first.currency_code)) {
    return { success: false, error: "Todas las deudas del abono deben estar en la misma moneda" };
  }
  if (active.some((d) => d.destinatario_id !== first.destinatario_id)) {
    return { success: false, error: "Un abono agrupado es con una sola persona" };
  }

  const decimals = getCurrencyDecimals(first.currency_code as CurrencyCode);
  const { allocations, unallocated } = allocatePaymentAcrossDebts(
    active.map((d) => ({
      id: d.id,
      outstanding_amount: Number(d.outstanding_amount),
      opened_on: d.opened_on,
      created_at: d.created_at,
    })),
    r.amount,
    decimals,
  );
  if (unallocated > 0) {
    const pending = active.reduce((s, d) => s + Number(d.outstanding_amount), 0);
    return {
      success: false,
      error: `El abono supera lo pendiente (${formatCurrency(pending, first.currency_code as CurrencyCode)})`,
    };
  }
  if (allocations.length === 0) return { success: false, error: "No hay saldo pendiente que abonar" };

  // Validation only — the balance is re-read right before it is written, so
  // the N inserts below never widen the window for clobbering a concurrent
  // change to the account.
  const { data: acct, error: acctErr } = await supabase
    .from("accounts")
    .select("id, account_type")
    .eq("id", r.account_id)
    .eq("user_id", user.id)
    .single();
  if (acctErr || !acct || acct.account_type == null) {
    return { success: false, error: "Cuenta no encontrada para aplicar balance" };
  }

  const byId = new Map(active.map((d) => [d.id, d]));
  const direction: "INFLOW" | "OUTFLOW" = first.direction === "borrowed" ? "OUTFLOW" : "INFLOW";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const personName = ((first as any).destinatario?.name as string | undefined) ?? "persona";
  const rawDescription = r.notes ?? `Abono ${personName}`;

  // Rows go in one at a time so a failure leaves a known prefix inserted; the
  // balance moves by exactly what landed, and a retry skips the rows already
  // there (idempotency key per debt + amount + date).
  let insertedTotal = 0;
  let inserted = 0;
  let skipped = 0;
  let failure: string | null = null;
  for (const a of allocations) {
    const debt = byId.get(a.id)!;
    try {
      const idempotencyKey = await computeIdempotencyKey({
        provider: "MANUAL",
        providerTransactionId: `personal-debt:${a.id}`,
        transactionDate: r.transaction_date,
        amount: a.amount,
        rawDescription,
      });
      const { data: row, error: insErr } = await supabase
        .from("transactions")
        .insert(
          buildRepaymentRow({
            userId: user.id,
            accountId: r.account_id,
            amount: a.amount,
            transactionDate: r.transaction_date,
            rawDescription,
            idempotencyKey,
            debt: {
              id: a.id,
              direction: debt.direction,
              currency_code: debt.currency_code,
              destinatario_id: debt.destinatario_id,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              is_ad_hoc: !!(debt as any).destinatario?.is_ad_hoc,
            },
          }),
        )
        .select("id, is_excluded")
        .single();
      if (insErr || !row) {
        if (insErr?.code === "23505") {
          skipped += 1;
          continue;
        }
        failure = "Error al registrar el abono";
        break;
      }
      inserted += 1;
      if (!row.is_excluded) insertedTotal += a.amount;
    } catch (e) {
      // A thrown error (network, not a PostgREST one) must not escape: rows
      // already inserted still need their balance, recompute and invalidation.
      console.error("recordGroupedRepayment insert threw:", e);
      failure = "Error al registrar el abono";
      break;
    }
  }

  // Every allocation already existed: a double-submit, same as the single path.
  if (inserted === 0 && skipped > 0) {
    return { success: false, error: "Este abono ya existe (duplicado)" };
  }

  // Balance: one delta for everything that landed in THIS call (same helper as
  // the single path), computed from a balance read right before the write.
  if (insertedTotal > 0) {
    const { data: fresh, error: freshErr } = await supabase
      .from("accounts")
      .select("current_balance")
      .eq("id", r.account_id)
      .eq("user_id", user.id)
      .single();
    if (freshErr || !fresh) {
      failure = failure ?? "Error al actualizar el saldo de la cuenta";
    } else {
      const nextBalance = applyAccountBalanceDelta({
        currentBalance: fresh.current_balance ?? 0,
        accountType: acct.account_type,
        direction,
        amount: insertedTotal,
      });
      const { error: balErr } = await supabase
        .from("accounts")
        .update({ current_balance: nextBalance })
        .eq("id", r.account_id)
        .eq("user_id", user.id);
      if (balErr) {
        failure = failure
          ? `${failure}. Además no se pudo actualizar el saldo de la cuenta`
          : "Abono registrado, pero no se pudo actualizar el saldo de la cuenta";
      }
    }
  }

  // Rows and balance are committed: recompute every touched debt and split
  // group even on a partial failure, then invalidate no matter what.
  try {
    const touched = allocations.slice(0, inserted + skipped);
    for (const a of touched) {
      const debt = byId.get(a.id)!;
      await recomputeOutstanding(supabase, user.id, a.id, Number(debt.principal_amount));
    }
    const groupIds = [...new Set(touched.map((a) => byId.get(a.id)!.split_group_id).filter((x): x is string => !!x))];
    for (const gid of groupIds) {
      await recomputeSplitRepaid(supabase, user.id, gid);
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
  if (failure) return { success: false, error: failure };
  return { success: true, data: { transactions: inserted, skipped } };
}

// ============================================================
// Vincular un movimiento existente a una PERSONA en general (o a un viaje):
// el abono se reparte entre las deudas elegidas, la más antigua primero.
//
// The movement stays ONE row. transactions.personal_debt_id points to the
// first debt of the split (anchor) with pd_role='repayment', so everything
// that treats "linked to a person" specially keeps working; each debt's share
// lives in personal_debt_allocations (anchor included) and
// personal_debt_repayment_amounts counts the shares instead of the full
// amount. A split that lands on a single debt is a plain link.
// ============================================================
export async function linkTransactionToPersonDebts(
  debtIds: string[],
  transactionId: string,
): Promise<ActionResult<{ debts: number }>> {
  const idsParsed = groupedRepaymentIdsSchema.safeParse(debtIds);
  if (!idsParsed.success) return { success: false, error: idsParsed.error.issues[0].message };
  if (!UUID_RE.test(transactionId)) return { success: false, error: "ID inválido" };
  const ids = [...new Set(idsParsed.data)];

  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .select(
      "id, direction, amount, currency_code, personal_debt_id, split_group_id, transfer_group_id, reconciled_into_transaction_id",
    )
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .single();
  if (txErr || !tx) return { success: false, error: "Transacción no encontrada" };
  if (tx.personal_debt_id) {
    return { success: false, error: "Esta transacción ya está vinculada a una persona." };
  }
  if (tx.split_group_id) {
    return { success: false, error: "Esta transacción pertenece a un pago compartido." };
  }
  if (tx.transfer_group_id) {
    return { success: false, error: "Esta transacción es una transferencia entre tus cuentas." };
  }
  if (tx.reconciled_into_transaction_id) {
    return { success: false, error: "Esta transacción fue conciliada con otro movimiento." };
  }

  const { data: debts, error: debtsErr } = await supabase
    .from("personal_debts")
    .select(
      "id, direction, status, principal_amount, outstanding_amount, currency_code, destinatario_id, opened_on, created_at",
    )
    .eq("user_id", user.id)
    .in("id", ids);
  if (debtsErr || !debts || debts.length !== ids.length) {
    return { success: false, error: "Alguna de las deudas no existe" };
  }
  if (debts.some((d) => d.status !== "active")) {
    return { success: false, error: "Alguna de las deudas ya no está activa. Recarga la página." };
  }
  const first = debts[0];
  if (debts.some((d) => d.destinatario_id !== first.destinatario_id)) {
    return { success: false, error: "Un abono repartido es con una sola persona" };
  }
  const txCurrency = tx.currency_code ?? "COP";
  if (debts.some((d) => d.currency_code !== txCurrency)) {
    return {
      success: false,
      error: `La moneda del movimiento (${txCurrency}) no coincide con la de las deudas.`,
    };
  }
  // Only an abono can be spread: a movement going the debt's own way is a new
  // loan and belongs to one debt (link it to that debt instead).
  const notRepayment = debts.some(
    (d) =>
      inferPersonalDebtRole(d.direction as PersonalDebtDirection, tx.direction as "INFLOW" | "OUTFLOW") !==
      "repayment",
  );
  if (notRepayment) {
    return {
      success: false,
      error:
        tx.direction === "INFLOW"
          ? "Este ingreso solo puede abonar a lo que te deben."
          : "Este gasto solo puede abonar a lo que debes.",
    };
  }

  const amount = Number(tx.amount ?? 0);
  const decimals = getCurrencyDecimals(txCurrency as CurrencyCode);
  const { allocations, unallocated } = allocatePaymentAcrossDebts(
    debts.map((d) => ({
      id: d.id,
      outstanding_amount: Number(d.outstanding_amount),
      opened_on: d.opened_on,
      created_at: d.created_at,
    })),
    amount,
    decimals,
  );
  if (unallocated > 0) {
    const pending = debts.reduce((s, d) => s + Number(d.outstanding_amount), 0);
    return {
      success: false,
      error: `El movimiento (${formatCurrency(amount, txCurrency as CurrencyCode)}) supera lo pendiente (${formatCurrency(pending, txCurrency as CurrencyCode)}). Vincúlalo a una deuda en particular.`,
    };
  }
  if (allocations.length === 0) return { success: false, error: "No hay saldo pendiente que abonar" };

  // One debt covers it: a plain link, no split rows.
  if (allocations.length === 1) {
    const res = await linkTransactionToPersonalDebt(allocations[0].id, transactionId);
    return res.success ? { success: true, data: { debts: 1 } } : res;
  }

  // Shares first, then the link: the view only counts shares of a movement
  // that is linked, so a failure between the two leaves nothing counted.
  const { error: allocErr } = await supabase.from("personal_debt_allocations").insert(
    allocations.map((a) => ({
      user_id: user.id,
      transaction_id: transactionId,
      personal_debt_id: a.id,
      amount: a.amount,
    })),
  );
  if (allocErr) {
    return {
      success: false,
      error: allocErr.code === "23505" ? "Esta transacción ya está repartida." : "Error al repartir el abono",
    };
  }

  const anchorId = allocations[0].id;
  const { data: linked, error: updErr } = await supabase
    .from("transactions")
    .update({ personal_debt_id: anchorId, pd_role: "repayment" })
    .eq("id", transactionId)
    .eq("user_id", user.id)
    // A concurrent link won the race: don't overwrite it.
    .is("personal_debt_id", null)
    .select("id");
  if (updErr || !linked || linked.length === 0) {
    await supabase
      .from("personal_debt_allocations")
      .delete()
      .eq("user_id", user.id)
      .eq("transaction_id", transactionId);
    return {
      success: false,
      error: updErr ? "Error al vincular la transacción" : "Esta transacción ya está vinculada a una persona.",
    };
  }

  try {
    await recomputeDebts(
      supabase,
      user.id,
      allocations.map((a) => a.id),
    );
  } catch (e) {
    revalidateFinancialViews();
    updateTag("personal-debts");
    const detail = e instanceof Error ? e.message : String(e);
    return { success: false, error: `Abono vinculado, pero no se pudo recalcular la deuda: ${detail}` };
  }

  revalidateFinancialViews();
  updateTag("personal-debts");
  return { success: true, data: { debts: allocations.length } };
}
