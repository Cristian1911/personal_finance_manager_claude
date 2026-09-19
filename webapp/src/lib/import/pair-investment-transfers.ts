import type { SupabaseClient } from "@supabase/supabase-js";
import { TRANSFER_CATEGORY_ID, getDebtPaymentCategoryId, isDebtAccountType } from "@zeta/shared";
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
 * neither leg already linked, and one of the two accounts is the fund.
 * Exactly one candidate, or nothing happens (an ambiguous pair is left for
 * the manual "Vincular" flow).
 */
export type InvestmentTransferLeg = {
  id: string;
  account_id: string;
  direction: "INFLOW" | "OUTFLOW";
  amount: number;
  currency_code: string;
  transaction_date: string;
  raw_description: string;
  merchant_name?: string | null;
  category_id?: string | null;
};

const FUND_SIDE_RE = /^(APERTURA|ADICI[OÓ]N|CONSIGNACI[OÓ]N|RETIRO|CANCELACI[OÓ]N)\b/i;
// Statements truncate: the savings side prints "TRASLADO DE FONDO DE INVERS".
const OTHER_SIDE_RE = /FONDO DE INVERS|FIDUCUENTA|FIDUCIARIA/i;
const WINDOW_DAYS = 3;
/** Fetch one more than we can accept so a full page reads as "ambiguous". */
const CANDIDATE_PAGE = 6;

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

/** Category a transfer leg carries when it has none: a debt-account inflow pays the debt. */
function transferLegCategoryId(direction: string, accountType: string | null | undefined): string {
  return direction === "INFLOW" && accountType && isDebtAccountType(accountType)
    ? getDebtPaymentCategoryId(accountType)
    : TRANSFER_CATEGORY_ID;
}

export async function pairInvestmentTransfers(
  supabase: SupabaseClient<Database>,
  userId: string,
  legs: InvestmentTransferLeg[],
  /** Accounts the current import treats as funds (their statements carried investment metadata). */
  investmentAccountIds: ReadonlySet<string> = new Set(),
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
  const isFund = (accountId: string) =>
    accountById.get(accountId)?.account_type === "INVESTMENT" || investmentAccountIds.has(accountId);
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
      .limit(CANDIDATE_PAGE);
    if (error) {
      result.errors.push(error.message);
      continue;
    }
    if ((candidates ?? []).length >= CANDIDATE_PAGE) continue; // too many to judge
    const eligible = (candidates ?? []).filter((c) => {
      const other = accountById.get(c.account_id);
      if (!other || other.is_demo !== legAccount.is_demo || claimed.has(c.id)) return false;
      // One side must be the fund; "FIDUCIARIA" in an unrelated description
      // must never neutralize two ordinary rows.
      return isFund(leg.account_id) || isFund(c.account_id);
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
      const { error: rollbackError } = await supabase
        .from("transactions")
        .update({ transfer_group_id: null, updated_at: now })
        .eq("user_id", userId)
        .eq("transfer_group_id", transferGroupId);
      if (rollbackError) {
        console.error("[pairInvestmentTransfers] rollback failed — half-tagged pair", {
          transferGroupId,
          legId: leg.id,
          counterpartId: counterpart.id,
          rollbackError,
        });
      }
      if (tagError) result.errors.push(tagError.message);
      continue;
    }

    // Re-derive the verdict on both legs now that the link exists (the
    // classifier returns SELF_TRANSFER / DEBT_PAYMENT for a linked pair) and
    // give an uncategorized leg the transfer category, as the manual link does.
    const updates = [
      {
        id: leg.id,
        columns: {
          ...flowClassColumns({
            direction: leg.direction,
            accountType: legAccount.account_type,
            description: leg.merchant_name ?? leg.raw_description,
            transferGroupId,
            counterpartAccountType: counterpartAccount.account_type,
          }),
          ...(leg.category_id
            ? {}
            : {
                category_id: transferLegCategoryId(leg.direction, legAccount.account_type),
                categorization_source: "SYSTEM_DEFAULT" as const,
              }),
          updated_at: now,
        },
      },
      {
        id: counterpart.id,
        columns: {
          ...flowClassColumns({
            direction: counterpart.direction,
            accountType: counterpartAccount.account_type,
            description: counterpart.merchant_name ?? counterpart.raw_description ?? null,
            transferGroupId,
            counterpartAccountType: legAccount.account_type,
          }),
          ...(counterpart.category_id
            ? {}
            : {
                category_id: transferLegCategoryId(counterpart.direction, counterpartAccount.account_type),
                categorization_source: "SYSTEM_DEFAULT" as const,
              }),
          updated_at: now,
        },
      },
    ];
    const outcomes = await Promise.all(
      updates.map((u) =>
        supabase.from("transactions").update(u.columns).eq("user_id", userId).eq("id", u.id),
      ),
    );
    for (const { error: updateError } of outcomes) {
      if (updateError) result.errors.push(`flow_class: ${updateError.message}`);
    }
    claimed.add(leg.id);
    claimed.add(counterpart.id);
    result.paired++;
  }
  return result;
}
