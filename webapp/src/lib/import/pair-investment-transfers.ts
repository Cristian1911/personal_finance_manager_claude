import type { SupabaseClient } from "@supabase/supabase-js";
import { flowClassColumns } from "@/lib/utils/flow-class-columns";
import type { Database } from "@/types/database";

/**
 * A movement into or out of a fondo de inversión is always a transfer with
 * one of the user's own accounts: the fund statement prints "APERTURA" /
 * "ADICIÓN" / "RETIRO" and the savings statement prints "TRASLADO A FONDO DE
 * INVERSIÓN". Neither text names the other account, so the structural
 * classifier sees the savings leg as spend and the fund leg as income — the
 * same money counted twice. Pair the legs at import instead: same amount and
 * currency, opposite direction, another own account, within three days,
 * neither leg already linked. Exactly one candidate, or nothing happens (an
 * ambiguous pair is left for the manual "Vincular" flow).
 */
export type InvestmentTransferLeg = {
  id: string;
  account_id: string;
  direction: "INFLOW" | "OUTFLOW";
  amount: number;
  currency_code: string;
  transaction_date: string;
  raw_description: string;
};

const FUND_SIDE_RE = /^(APERTURA|ADICI[OÓ]N|CONSIGNACI[OÓ]N|RETIRO|CANCELACI[OÓ]N)\b/i;
// Statements truncate: the savings side prints "TRASLADO DE FONDO DE INVERS".
const OTHER_SIDE_RE = /FONDO DE INVERS|FIDUCUENTA|FIDUCIARIA/i;
const WINDOW_DAYS = 3;

export function isInvestmentTransferLeg(
  description: string,
  accountIsInvestment: boolean,
): boolean {
  const text = description.trim();
  return (accountIsInvestment && FUND_SIDE_RE.test(text)) || OTHER_SIDE_RE.test(text);
}

function shiftIsoDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function pairInvestmentTransfers(
  supabase: SupabaseClient<Database>,
  userId: string,
  legs: InvestmentTransferLeg[],
): Promise<{ paired: number; errors: string[] }> {
  const result = { paired: 0, errors: [] as string[] };
  if (legs.length === 0) return result;

  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id, account_type, is_demo")
    .eq("user_id", userId);
  if (accountsError) {
    result.errors.push(accountsError.message);
    return result;
  }
  const accountById = new Map((accounts ?? []).map((a) => [a.id, a]));
  const claimed = new Set<string>();

  for (const leg of legs) {
    if (claimed.has(leg.id)) continue;
    const legAccount = accountById.get(leg.account_id);
    if (!legAccount) continue;
    const { data: candidates, error } = await supabase
      .from("transactions")
      .select("id, account_id, direction, amount, currency_code, transaction_date, merchant_name, raw_description, category_id")
      .eq("user_id", userId)
      .neq("account_id", leg.account_id)
      .eq("direction", leg.direction === "INFLOW" ? "OUTFLOW" : "INFLOW")
      .eq("amount", leg.amount)
      .eq("currency_code", leg.currency_code as Database["public"]["Enums"]["currency_code"])
      .gte("transaction_date", shiftIsoDate(leg.transaction_date, -WINDOW_DAYS))
      .lte("transaction_date", shiftIsoDate(leg.transaction_date, WINDOW_DAYS))
      .is("transfer_group_id", null)
      .is("reconciled_into_transaction_id", null)
      .is("personal_debt_id", null)
      .is("split_group_id", null)
      .eq("is_excluded", false)
      .limit(5);
    if (error) {
      result.errors.push(error.message);
      continue;
    }
    const eligible = (candidates ?? []).filter((c) => {
      const other = accountById.get(c.account_id);
      return other != null && other.is_demo === legAccount.is_demo && !claimed.has(c.id);
    });
    if (eligible.length !== 1) continue;
    const counterpart = eligible[0];
    const counterpartAccount = accountById.get(counterpart.account_id)!;

    const transferGroupId = crypto.randomUUID();
    const now = new Date().toISOString();
    const { data: tagged, error: tagError } = await supabase
      .from("transactions")
      .update({ transfer_group_id: transferGroupId, updated_at: now })
      .eq("user_id", userId)
      .in("id", [leg.id, counterpart.id])
      .is("transfer_group_id", null)
      .select("id");
    if (tagError || tagged?.length !== 2) {
      await supabase
        .from("transactions")
        .update({ transfer_group_id: null, updated_at: now })
        .eq("user_id", userId)
        .eq("transfer_group_id", transferGroupId);
      if (tagError) result.errors.push(tagError.message);
      continue;
    }
    // Re-derive the verdict on both legs now that the link exists: the
    // classifier returns SELF_TRANSFER for a linked pair.
    await Promise.all([
      supabase
        .from("transactions")
        .update(
          flowClassColumns({
            direction: leg.direction,
            accountType: legAccount.account_type,
            description: leg.raw_description,
            transferGroupId,
            matchedAccountType: counterpartAccount.account_type,
          }),
        )
        .eq("user_id", userId)
        .eq("id", leg.id),
      supabase
        .from("transactions")
        .update(
          flowClassColumns({
            direction: counterpart.direction,
            accountType: counterpartAccount.account_type,
            description: counterpart.merchant_name ?? counterpart.raw_description ?? null,
            transferGroupId,
            matchedAccountType: legAccount.account_type,
          }),
        )
        .eq("user_id", userId)
        .eq("id", counterpart.id),
    ]);
    claimed.add(leg.id);
    claimed.add(counterpart.id);
    result.paired++;
  }
  return result;
}
