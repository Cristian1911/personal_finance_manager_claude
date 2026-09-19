"use server";

import { cacheLife, cacheTag, updateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { revalidateFinancialViews } from "@/lib/cache/revalidation";
import { getIsDemoFilter } from "@/lib/demo-filter";
import { fetchStatementTrayRows, type StatementTrayRow } from "@/lib/import/statement-tray";
import { UUID_RE } from "@/lib/validators/shared";
import { deleteTransaction } from "@/actions/transactions";
import type { ActionResult } from "@/types/actions";

export type { StatementTrayRow };

export type StatementTray = { rows: StatementTrayRow[]; truncated: boolean };

async function getStatementTrayCached(accessToken: string, userId: string, isDemo: boolean): Promise<StatementTray> {
  "use cache";
  cacheTag("statement-tray");
  cacheTag("transactions");
  cacheTag("snapshots");
  cacheLife("zeta");
  const supabase = createCachedClient(accessToken);
  return fetchStatementTrayRows(supabase, userId, { isDemo });
}

/** Card movements from alerts/screenshots that an imported statement did not back. */
export async function getStatementTray(): Promise<ActionResult<StatementTray>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  try {
    const isDemo = await getIsDemoFilter(user.id);
    return { success: true, data: await getStatementTrayCached(accessToken, user.id, isDemo) };
  } catch {
    return { success: false, error: "No se pudo cargar la bandeja del extracto" };
  }
}

/**
 * Resolve tray rows: `deleteIds` are removed from the ledger, `keepIds` are
 * remembered so the tray stops proposing them.
 *
 * Balance: a row that was already in the ledger when the statement was
 * imported had its delta overwritten by the statement balance (which never
 * included the movement), so deleting it must NOT reverse anything. A row
 * captured AFTER that import (an alert approved late, a screenshot) applied a
 * live delta, so it goes through `deleteTransaction`, which reverses it.
 */
export async function resolveStatementTray(input: {
  deleteIds?: string[];
  keepIds?: string[];
}): Promise<ActionResult<{ deleted: number; kept: number }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const deleteIds = [...new Set((input.deleteIds ?? []).filter((id) => UUID_RE.test(id)))];
  const keepIds = [...new Set((input.keepIds ?? []).filter((id) => UUID_RE.test(id) && !deleteIds.includes(id)))];
  if (deleteIds.length === 0 && keepIds.length === 0) {
    return { success: true, data: { deleted: 0, kept: 0 } };
  }

  // Only rows the tray itself would list may be touched: same filters as
  // the read (ownership, tier 2, unreconciled, no debt/share/occurrence links).
  const isDemo = await getIsDemoFilter(user.id);
  const { rows: trayRows } = await fetchStatementTrayRows(supabase, user.id, { isDemo });
  const eligible = new Map(trayRows.map((r) => [r.id, r]));
  const toDelete = deleteIds.filter((id) => eligible.has(id));
  const toKeep = keepIds.filter((id) => eligible.has(id));

  let deleted = 0;
  const liveDelta = toDelete.filter((id) => eligible.get(id)!.balance_delta_live);
  const anchored = toDelete.filter((id) => !eligible.get(id)!.balance_delta_live);
  if (anchored.length > 0) {
    const { data, error } = await supabase
      .from("transactions")
      .delete()
      .eq("user_id", user.id)
      .in("id", anchored)
      .select("id");
    if (error) return { success: false, error: error.message };
    deleted += data?.length ?? 0;
  }
  for (const id of liveDelta) {
    const result = await deleteTransaction(id);
    if (!result.success) {
      updateTag("statement-tray");
      return { success: false, error: result.error };
    }
    deleted++;
  }

  let kept = 0;
  if (toKeep.length > 0) {
    const { data, error } = await supabase
      .from("statement_tray_dismissals")
      .upsert(
        toKeep.map((transaction_id) => ({ user_id: user.id, transaction_id })),
        { onConflict: "transaction_id", ignoreDuplicates: true },
      )
      .select("transaction_id");
    if (error) return { success: false, error: error.message };
    kept = data?.length ?? 0;
  }

  if (deleted > 0) revalidateFinancialViews();
  updateTag("statement-tray");
  return { success: true, data: { deleted, kept } };
}
