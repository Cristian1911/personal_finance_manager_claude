import "server-only";

const PAGE = 1000;

/**
 * Σ repaid per personal debt, from `personal_debt_repayment_amounts`: a
 * linked repayment counts in full on its debt, an abono split across several
 * of a person's debts counts by each debt's share. The one read every
 * "total_repaid" goes through, so a split abono never lands whole on its
 * anchor debt. Paged: PostgREST caps a response at its max-rows setting.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readRepaidByDebt(supabase: any, userId: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("personal_debt_repayment_amounts")
      .select("personal_debt_id, transaction_id, amount")
      .eq("user_id", userId)
      .order("transaction_id", { ascending: true })
      .order("personal_debt_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as { personal_debt_id: string; amount: number | null }[];
    for (const r of rows) {
      out.set(r.personal_debt_id, (out.get(r.personal_debt_id) ?? 0) + Number(r.amount ?? 0));
    }
    if (rows.length < PAGE) break;
  }
  return out;
}
