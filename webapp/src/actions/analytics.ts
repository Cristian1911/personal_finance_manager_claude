"use server";

import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import type {
  AnalyticsTx,
  CategoryHierarchyNode,
  CategoryMeta,
  DestinatarioMeta,
  RecurringObligation,
} from "@zeta/shared";
import { isDebtAccountType,
  COUNTED_FLOW_CLASSES,
} from "@zeta/shared";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { getIsDemoFilter } from "@/lib/demo-filter";
import { uuidStr } from "@/lib/validators/shared";
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
  /** Flat parent+leaf breakdown with windowed totals — feeds the interactive
   *  "Gasto por categoría" accordion (search + expand, zero per-tap fetch). */
  categoryHierarchy: CategoryHierarchyNode[];
  currentBalance: number;
  recurring: RecurringObligation[];
  horizonMonths: string[];
}

const EMPTY: Omit<TendenciasDataset, "months" | "horizonMonths"> = {
  rows: [],
  debtAccountIds: [],
  categoryMeta: [],
  destinatarioMeta: [],
  categoryHierarchy: [],
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

  // One accounts fetch (demo filter inline) replaces getDemoAccountIds + the
  // redundant per-id refetch — same WHERE clause, one fewer serial round-trip.
  const { data: accountRows, error: accountsErr } = await supabase
    .from("accounts")
    .select("id, account_type, current_balance, currency_code")
    .eq("user_id", userId)
    // No `is_active` filter: this scopes a HISTORY query. An archived account
    // (a loan archived once it was paid off) still owns the movements it had
    // while it was open — see getDemoAccountIds.
    .eq("is_demo", isDemo);
  if (accountsErr) throw accountsErr;
  if (!accountRows?.length) return { ...EMPTY, months, horizonMonths };
  const accountIds = accountRows.map((a) => a.id);

  const [txRes, budgetsRes, destRes, catsRes] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "transaction_date, amount, split_repaid_amount, direction, category_id, destinatario_id, account_id, categories!category_id(name_es, name, color, expense_type)",
      )
      .eq("user_id", userId)
      .in("account_id", accountIds)
      .eq("is_excluded", false)
      .eq("currency_code", cur)
      .gte("transaction_date", from)
      .lte("transaction_date", to)
      .is("reconciled_into_transaction_id", null)
      .in("flow_class_effective", COUNTED_FLOW_CLASSES as string[])
      .is("personal_debt_id", null),
    supabase.from("budgets").select("category_id, amount").eq("user_id", userId),
    supabase.from("destinatarios").select("id, name").eq("user_id", userId),
    // Parent/child links for the hierarchy. No is_active filter: a deactivated
    // category that still has windowed spend must resolve its name + parent.
    supabase
      .from("categories")
      .select("id, parent_id, name_es, name, color")
      .or(`user_id.eq.${userId},user_id.is.null`),
  ]);

  if (txRes.error) throw txRes.error;
  if (budgetsRes.error) throw budgetsRes.error;
  if (destRes.error) throw destRes.error;
  if (catsRes.error) throw catsRes.error;

  const budgetMap = new Map<string, number>();
  for (const b of budgetsRes.data ?? []) {
    if (b.category_id) budgetMap.set(b.category_id, Number(b.amount));
  }

  const debtAccountIds: string[] = [];
  let currentBalance = 0;
  for (const a of accountRows) {
    if (isDebtAccountType(a.account_type)) debtAccountIds.push(a.id);
    else if (a.currency_code === cur) currentBalance += Number(a.current_balance ?? 0);
  }

  const rows: AnalyticsTx[] = [];
  const categoryMeta = new Map<string, CategoryMeta>();
  for (const t of txRes.data ?? []) {
    const cat = t.categories as { name_es: string | null; name: string; color: string | null; expense_type: string | null } | null;
    const expenseType = cat?.expense_type === "fixed" || cat?.expense_type === "variable" ? cat.expense_type : null;
    rows.push({
      // Effective spend nets what participants of a shared payment already paid
      // back, matching charts.ts and budgets.ts. Without it a $400k split
      // dinner showed as $400k here and ~$100k in Presupuesto.
      amount:
        t.direction === "OUTFLOW"
          ? Number(t.amount) - Number(t.split_repaid_amount ?? 0)
          : Number(t.amount),
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

  const usedDestIds = new Set(rows.map((r) => r.destinatarioId).filter(Boolean));
  const destinatarioMeta: [string, DestinatarioMeta][] = (destRes.data ?? [])
    .filter((d) => usedDestIds.has(d.id))
    .map((d) => [d.id, { name: d.name, color: destColor(d.id) }]);

  const categoryHierarchy = buildCategoryHierarchy(rows, catsRes.data ?? [], categoryMeta, months);

  return {
    rows,
    months,
    debtAccountIds,
    categoryMeta: [...categoryMeta.entries()],
    destinatarioMeta,
    categoryHierarchy,
    currentBalance,
    // ponytail: forecast runs on avg-net only for now. Obligation-aware forecast
    // needs ensureCurrentOccurrences (a mutation) — can't run inside "use cache".
    // Wire pending OUTFLOW occurrences by month in a follow-up. See BACKLOG.
    recurring: [],
    horizonMonths,
  };
}

type CategoryLink = { id: string; parent_id: string | null; name_es: string | null; name: string; color: string | null };

/**
 * Flatten the category tree into [parent, ...leaves] nodes carrying windowed
 * OUTFLOW totals. `rows` are already date/currency-filtered by the dataset query,
 * so totals reconcile with `categorySeries`. Depth >2 is collapsed to the
 * top-level ancestor (the accordion is 2-level), so no spend is orphaned.
 */
function buildCategoryHierarchy(
  rows: readonly AnalyticsTx[],
  cats: readonly CategoryLink[],
  categoryMeta: ReadonlyMap<string, CategoryMeta>,
  months: readonly string[],
): CategoryHierarchyNode[] {
  const info = new Map<string, { nameEs: string; color: string; parentId: string | null }>();
  for (const c of cats) {
    info.set(c.id, {
      nameEs: c.name_es ?? c.name ?? "Sin categoría",
      color: c.color ?? "#768053",
      parentId: c.parent_id,
    });
  }
  const nameOf = (id: string) => info.get(id)?.nameEs ?? categoryMeta.get(id)?.nameEs ?? "Sin categoría";
  const colorOf = (id: string) => info.get(id)?.color ?? categoryMeta.get(id)?.color ?? "#768053";

  // Own OUTFLOW monthly series per category id (matches categorySeries: OUTFLOW
  // only, bucketed by config.months). Scalar own total is the row sum.
  const monthIndex = new Map(months.map((m, i) => [m, i]));
  const ownMonthly = new Map<string, number[]>();
  for (const r of rows) {
    if (r.direction !== "OUTFLOW" || !r.categoryId) continue;
    const mi = monthIndex.get(r.date.slice(0, 7));
    if (mi === undefined) continue;
    let arr = ownMonthly.get(r.categoryId);
    if (!arr) {
      arr = new Array(months.length).fill(0);
      ownMonthly.set(r.categoryId, arr);
    }
    arr[mi] += r.amount;
  }
  const ownOf = (id: string) => ownMonthly.get(id) ?? new Array(months.length).fill(0);
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  // Same MoM as categorySeries: last vs prev month; null when prev is 0.
  const momOf = (arr: number[]): number | null => {
    const prev = arr[arr.length - 2] ?? 0;
    const last = arr[arr.length - 1] ?? 0;
    return prev === 0 ? null : ((last - prev) / prev) * 100;
  };

  const rootOf = (id: string): string => {
    let cur = id;
    for (let i = 0; i < 8; i++) {
      const p = info.get(cur)?.parentId;
      if (!p) break;
      cur = p;
    }
    return cur;
  };

  const childrenByRoot = new Map<string, string[]>();
  const rootIds = new Set<string>();
  for (const catId of ownMonthly.keys()) {
    const root = rootOf(catId);
    rootIds.add(root);
    if (catId !== root) {
      const arr = childrenByRoot.get(root);
      if (arr) arr.push(catId);
      else childrenByRoot.set(root, [catId]);
    }
  }

  const roots = [...rootIds].map((rootId) => {
    const ownTotal = sum(ownOf(rootId));
    const childIds = (childrenByRoot.get(rootId) ?? []).sort(
      (a, b) => sum(ownOf(b)) - sum(ownOf(a)),
    );
    // Rolled monthly = root own + Σ children own, element-wise across months.
    const rolledMonthly = ownOf(rootId).slice();
    for (const c of childIds) {
      const cm = ownOf(c);
      for (let i = 0; i < rolledMonthly.length; i++) rolledMonthly[i] += cm[i];
    }
    return { rootId, ownTotal, childIds, rolledMonthly, rolledTotal: sum(rolledMonthly) };
  });
  roots.sort((a, b) => b.rolledTotal - a.rolledTotal);

  const out: CategoryHierarchyNode[] = [];
  for (const { rootId, ownTotal, childIds, rolledMonthly, rolledTotal } of roots) {
    out.push({
      id: rootId,
      parentId: null,
      nameEs: nameOf(rootId),
      color: colorOf(rootId),
      isLeaf: childIds.length === 0,
      childIds,
      ownTotal,
      rolledTotal,
      // Top-level row shows rolledTotal → its trend is the rolled series.
      monthly: rolledMonthly,
      momPct: momOf(rolledMonthly),
    });
    for (const childId of childIds) {
      const cMonthly = ownOf(childId);
      out.push({
        id: childId,
        parentId: rootId,
        nameEs: nameOf(childId),
        color: colorOf(childId),
        isLeaf: true,
        childIds: [],
        ownTotal: sum(cMonthly),
        rolledTotal: sum(cMonthly),
        // Leaf row shows ownTotal → its trend is the own series.
        monthly: cMonthly,
        momPct: momOf(cMonthly),
      });
    }
  }
  return out;
}

// ─── Read-only drilldown for interactive Tendencias cards ────────────────────
//
// Fetches the transactions behind a single category OR destinatario for the
// active period window. Display-only (no mutation surface). Filters mirror the
// dataset aggregation (OUTFLOW, currency, demo scope, transfer/reconciled/origin
// exclusions) so the rows reconcile with the totals shown in the cards.

export interface DrilldownTransaction {
  id: string;
  date: string; // transaction_date, YYYY-MM-DD
  description: string; // merchant_name || clean_description || fallback
  amount: number; // always positive
  currencyCode: CurrencyCode;
  direction: "INFLOW" | "OUTFLOW";
  accountLabel: string;
}

export interface DrilldownParams {
  categoryId?: string;
  destinatarioId?: string;
  dateFrom: string; // YYYY-MM-DD inclusive
  dateTo: string; // YYYY-MM-DD inclusive
  currency?: CurrencyCode;
  limit?: number;
}

// Match the currency_code enum used across validators (transaction.ts). Avoids
// z.string().uuid() / open strings reaching the cached query untrusted.
const DRILLDOWN_CURRENCY_CODES = ["COP", "BRL", "MXN", "USD", "EUR", "PEN", "CLP", "ARS"] as const;

const drilldownParamsSchema = z
  .object({
    categoryId: uuidStr().optional(),
    destinatarioId: uuidStr().optional(),
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    currency: z.enum(DRILLDOWN_CURRENCY_CODES).optional(),
    // Coerce + clamp the limit to [1, 200] (default 100) so a hostile/buggy
    // caller can't request an unbounded result set.
    limit: z.coerce
      .number()
      .default(100)
      .transform((n) => Math.min(200, Math.max(1, Math.round(n)))),
  })
  // Exactly one of categoryId / destinatarioId — both or neither is ambiguous.
  .refine((p) => (p.categoryId ? 1 : 0) + (p.destinatarioId ? 1 : 0) === 1);

export async function getDrilldownTransactions(params: DrilldownParams): Promise<DrilldownTransaction[]> {
  const parsed = drilldownParamsSchema.safeParse(params);
  if (!parsed.success) return [];
  const p = parsed.data;
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return [];
  const isDemo = await getIsDemoFilter(user.id);
  try {
    return await getDrilldownTransactionsCached(
      accessToken,
      user.id,
      p.dateFrom,
      p.dateTo,
      p.categoryId,
      p.destinatarioId,
      (p.currency ?? "COP") as CurrencyCode,
      p.limit,
      isDemo,
    );
  } catch {
    return [];
  }
}

async function getDrilldownTransactionsCached(
  accessToken: string,
  userId: string,
  dateFrom: string,
  dateTo: string,
  categoryId: string | undefined,
  destinatarioId: string | undefined,
  currency: CurrencyCode,
  limit: number,
  // `isDemo` MUST stay an explicit cached-fn parameter so demo-mode changes get a
  // distinct cache key — otherwise demo data could be served to non-demo users.
  isDemo: boolean,
): Promise<DrilldownTransaction[]> {
  "use cache";
  cacheTag("transactions");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  // Single inner-join query: filtering the embedded account (is_active/is_demo)
  // replaces the separate accounts prefetch + `.in("account_id", ...)`. Same
  // result set, one fewer serial round-trip. Tx.user_id == account.user_id (FK +
  // RLS), so the per-tx user filter preserves the old per-account user scope.
  let query = supabase
    .from("transactions")
    .select(
      "id, transaction_date, amount, split_repaid_amount, direction, currency_code, merchant_name, clean_description, account:accounts!transactions_account_id_fkey!inner(name)",
    )
    .eq("user_id", userId)
    .eq("account.is_active", true)
    .eq("account.is_demo", isDemo)
    .eq("is_excluded", false)
    .eq("currency_code", currency)
    .eq("direction", "OUTFLOW")
    .gte("transaction_date", dateFrom)
    .lte("transaction_date", dateTo)
    .is("reconciled_into_transaction_id", null)
      .in("flow_class_effective", COUNTED_FLOW_CLASSES as string[])
    .is("personal_debt_id", null)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (categoryId) query = query.eq("category_id", categoryId);
  if (destinatarioId) query = query.eq("destinatario_id", destinatarioId);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((t) => {
    const account = t.account as { name: string | null } | null;
    return {
      id: t.id,
      date: t.transaction_date,
      description: t.merchant_name || t.clean_description || "Sin descripción",
      // Same effective-spend rule as the aggregates above, so a drill-down row
      // never contradicts the total it was opened from.
      amount: Number(t.amount) - Number(t.split_repaid_amount ?? 0),
      currencyCode: (t.currency_code ?? currency) as CurrencyCode,
      direction: t.direction as "INFLOW" | "OUTFLOW",
      accountLabel: account?.name ?? "Cuenta",
    };
  });
}
