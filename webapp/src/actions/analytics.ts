"use server";

import { cacheLife, cacheTag } from "next/cache";
import type { AnalyticsTx, CategoryMeta, DestinatarioMeta, RecurringObligation } from "@zeta/shared";
import { isDebtAccountType } from "@zeta/shared";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { getDemoAccountIds, getIsDemoFilter } from "@/lib/demo-filter";
import type { CurrencyCode } from "@/types/domain";
import { type AnalyticsRange, nextMonths, rangeToWindow } from "@/lib/analytics/range";

/**
 * Serializable raw dataset — the page rebuilds Set/Map into an AnalyticsConfig
 * before calling the @zeta/shared/analytics engine. One cached fetch feeds every
 * Tendencias section (no N-queries).
 */
export interface TendenciasDataset {
  rows: AnalyticsTx[];
  months: string[];
  debtAccountIds: string[];
  categoryMeta: [string, CategoryMeta][];
  destinatarioMeta: [string, DestinatarioMeta][];
  currentBalance: number;
  recurring: RecurringObligation[];
  horizonMonths: string[];
}

const EMPTY: Omit<TendenciasDataset, "months" | "horizonMonths"> = {
  rows: [],
  debtAccountIds: [],
  categoryMeta: [],
  destinatarioMeta: [],
  currentBalance: 0,
  recurring: [],
};

// Deterministic brand-palette color for a destinatario id (destinatarios have no color column).
const D_PALETTE = ["#937844", "#5CB88A", "#E8875A", "#768053", "#B29256", "#D9CCB9"];
function destColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return D_PALETTE[h % D_PALETTE.length];
}

export async function getTendenciasDataset(range: AnalyticsRange = "6M", currency?: CurrencyCode): Promise<TendenciasDataset> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) throw new Error("No autenticado");
  const isDemo = await getIsDemoFilter(user.id);
  return getTendenciasDatasetCached(accessToken, user.id, range, currency, isDemo);
}

async function getTendenciasDatasetCached(
  accessToken: string,
  userId: string,
  range: AnalyticsRange,
  currency: CurrencyCode | undefined,
  isDemo: boolean,
): Promise<TendenciasDataset> {
  "use cache";
  cacheTag("analytics");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const cur = currency ?? "COP";
  const { from, to, months } = rangeToWindow(range);
  const horizonMonths = nextMonths(months[months.length - 1], 3);

  const accountIds = await getDemoAccountIds(supabase, userId, isDemo);
  if (!accountIds) return { ...EMPTY, months, horizonMonths };

  const [txRes, budgetsRes, accountsRes, destRes] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "transaction_date, amount, direction, category_id, destinatario_id, account_id, categories!category_id(name_es, name, color, expense_type)",
      )
      .eq("user_id", userId)
      .in("account_id", accountIds)
      .eq("is_excluded", false)
      .eq("currency_code", cur)
      .gte("transaction_date", from)
      .lte("transaction_date", to)
      .is("reconciled_into_transaction_id", null)
      .is("transfer_group_id", null)
      .or("personal_debt_id.is.null,pd_role.neq.origin"),
    supabase.from("budgets").select("category_id, amount").eq("user_id", userId),
    supabase.from("accounts").select("id, account_type, current_balance, currency_code").eq("user_id", userId).in("id", accountIds),
    supabase.from("destinatarios").select("id, name").eq("user_id", userId),
  ]);

  if (txRes.error) throw txRes.error;
  if (budgetsRes.error) throw budgetsRes.error;
  if (accountsRes.error) throw accountsRes.error;
  if (destRes.error) throw destRes.error;

  const budgetMap = new Map<string, number>();
  for (const b of budgetsRes.data ?? []) {
    if (b.category_id) budgetMap.set(b.category_id, Number(b.amount));
  }

  const debtAccountIds: string[] = [];
  let currentBalance = 0;
  for (const a of accountsRes.data ?? []) {
    if (isDebtAccountType(a.account_type)) debtAccountIds.push(a.id);
    else if (a.currency_code === cur) currentBalance += Number(a.current_balance ?? 0);
  }

  const rows: AnalyticsTx[] = [];
  const categoryMeta = new Map<string, CategoryMeta>();
  for (const t of txRes.data ?? []) {
    const cat = t.categories as { name_es: string | null; name: string; color: string | null; expense_type: string | null } | null;
    const expenseType = cat?.expense_type === "fixed" || cat?.expense_type === "variable" ? cat.expense_type : null;
    rows.push({
      amount: t.amount,
      direction: t.direction as "INFLOW" | "OUTFLOW",
      date: t.transaction_date,
      categoryId: t.category_id,
      destinatarioId: t.destinatario_id,
      accountId: t.account_id,
      expenseType,
    });
    if (t.category_id && !categoryMeta.has(t.category_id)) {
      categoryMeta.set(t.category_id, {
        nameEs: cat?.name_es ?? cat?.name ?? "Sin categoría",
        color: cat?.color ?? "#768053",
        expenseType,
        budgetTarget: budgetMap.get(t.category_id) ?? null,
      });
    }
  }

  const destinatarioMeta: [string, DestinatarioMeta][] = (destRes.data ?? []).map((d) => [d.id, { name: d.name, color: destColor(d.id) }]);

  return {
    rows,
    months,
    debtAccountIds,
    categoryMeta: [...categoryMeta.entries()],
    destinatarioMeta,
    currentBalance,
    // ponytail: forecast runs on avg-net only for now. Obligation-aware forecast
    // needs ensureCurrentOccurrences (a mutation) — can't run inside "use cache".
    // Wire pending OUTFLOW occurrences by month in a follow-up. See BACKLOG.
    recurring: [],
    horizonMonths,
  };
}
