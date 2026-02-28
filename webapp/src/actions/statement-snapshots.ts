"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types/actions";
import type { Tables } from "@/types/database";

export type StatementSnapshot = Tables<"statement_snapshots">;

export async function getStatementSnapshots(
  accountId: string
): Promise<ActionResult<StatementSnapshot[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("statement_snapshots")
    .select("*")
    .eq("user_id", user.id)
    .eq("account_id", accountId)
    .order("period_to", { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, data: data ?? [] };
}
