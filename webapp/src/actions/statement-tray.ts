"use server";

import { cacheLife, cacheTag, updateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { revalidateFinancialViews } from "@/lib/cache/revalidation";
import { fetchStatementTrayRows, type StatementTrayRow } from "@/lib/import/statement-tray";
import { UUID_RE } from "@/lib/validators/shared";
import type { ActionResult } from "@/types/actions";

export type { StatementTrayRow };

async function getStatementTrayCached(accessToken: string, userId: string): Promise<StatementTrayRow[]> {
  "use cache";
  cacheTag("statement-tray");
  cacheTag("transactions");
  cacheTag("snapshots");
  cacheLife("zeta");
  const supabase = createCachedClient(accessToken);
  return fetchStatementTrayRows(supabase, userId);
}

/** Card movements from alerts/screenshots that an imported statement did not back. */
export async function getStatementTray(): Promise<ActionResult<StatementTrayRow[]>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  try {
    return { success: true, data: await getStatementTrayCached(accessToken, user.id) };
  } catch {
    return { success: false, error: "No se pudo cargar la bandeja del extracto" };
  }
}

/**
 * Resolve tray rows: `deleteIds` are removed from the ledger, `keepIds` are
 * remembered so the tray stops proposing them.
 *
 * Deleting here does NOT replay a balance delta: every row in the tray sits
 * inside a statement period whose import already set the card balance from
 * the statement (which never included these movements), so reversing the
 * alert's delta would drift the balance by exactly the amount the statement
 * had already left out.
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
  // the read (ownership, tier 2, unreconciled, no debt/share links).
  const trayRows = await fetchStatementTrayRows(supabase, user.id);
  const eligible = new Set(trayRows.map((r) => r.id));
  const toDelete = deleteIds.filter((id) => eligible.has(id));
  const toKeep = keepIds.filter((id) => eligible.has(id));

  let deleted = 0;
  if (toDelete.length > 0) {
    const { data, error } = await supabase
      .from("transactions")
      .delete()
      .eq("user_id", user.id)
      .in("id", toDelete)
      .select("id");
    if (error) return { success: false, error: error.message };
    deleted = data?.length ?? 0;
  }

  let kept = 0;
  if (toKeep.length > 0) {
    const { error } = await supabase
      .from("statement_tray_dismissals")
      .upsert(
        toKeep.map((transaction_id) => ({ user_id: user.id, transaction_id })),
        { onConflict: "transaction_id", ignoreDuplicates: true },
      );
    if (error) return { success: false, error: error.message };
    kept = toKeep.length;
  }

  if (deleted > 0) revalidateFinancialViews();
  updateTag("statement-tray");
  return { success: true, data: { deleted, kept } };
}
