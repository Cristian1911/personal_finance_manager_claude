"use server";

import { cacheTag, cacheLife } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/types/actions";
import type { Tables } from "@/types/database";

export type StatementSnapshot = Tables<"statement_snapshots">;

// ─── Cached inner functions ───────────────────────────────────────────────────

async function getLatestSnapshotDatesCached(
  userId: string
): Promise<Record<string, string>> {
  "use cache";
  cacheTag("snapshots");
  cacheLife("zeta");

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("statement_snapshots")
    .select("account_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!data) return {};

  // Keep only the most recent per account
  const result: Record<string, string> = {};
  for (const row of data) {
    if (!result[row.account_id]) {
      result[row.account_id] = row.created_at;
    }
  }
  return result;
}

async function getStatementSnapshotsCached(
  userId: string,
  accountId: string
): Promise<StatementSnapshot[]> {
  "use cache";
  cacheTag("snapshots");
  cacheLife("zeta");

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("statement_snapshots")
    .select("*")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .order("period_to", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// ─── Public wrappers ──────────────────────────────────────────────────────────

/**
 * Get the most recent snapshot created_at per account.
 * Used by the dashboard alerts to determine import staleness.
 */
export async function getLatestSnapshotDates(): Promise<
  Record<string, string>
> {
  const { user } = await getAuthenticatedClient();
  if (!user) return {};
  try {
    return await getLatestSnapshotDatesCached(user.id);
  } catch (error) {
    console.error("Error loading snapshot dates:", error);
    return {};
  }
}

export async function getStatementSnapshots(
  accountId: string
): Promise<ActionResult<StatementSnapshot[]>> {
  const { user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  try {
    const data = await getStatementSnapshotsCached(user.id, accountId);
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al cargar los extractos";
    return { success: false, error: message };
  }
}
