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
import { isDebtAccountType } from "@zeta/shared";
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
    .eq("is_active", true)
    .eq("is_demo", isDemo);
  if (accountsErr) throw accountsErr;
  if (!accountRows?.length) return { ...EMPTY, months, horizonMonths };
  const accountIds = accountRows.map((a) => a.id);

  const [txRes, budgetsRes, destRes, catsRes] = await Promise.all([
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

  const usedDestIds = new Set(rows.map((r) => r.destinatarioId).filter(Boolean));
  const destinatarioMeta: [string, DestinatarioMeta][] = (destRes.data ?? [])
    .filter((d) => usedDestIds.has(d.id))
    .map((d) => [d.id, { name: d.name, color: destColor(d.id) }]);

  const categoryHierarchy = buildCategoryHierarchy(rows, catsRes.data ?? [], categoryMeta);

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

  // Own OUTFLOW spend per category id (matches categorySeries: OUTFLOW only).
  const own = new Map<string, number>();
  for (const r of rows) {
    if (r.direction !== "OUTFLOW" || !r.categoryId) continue;
    own.set(r.categoryId, (own.get(r.categoryId) ?? 0) + r.amount);
  }

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
  for (const catId of own.keys()) {
    const root = rootOf(catId);
    rootIds.add(root);
    if (catId !== root) {
      const arr = childrenByRoot.get(root);
      if (arr) arr.push(catId);
      else childrenByRoot.set(root, [catId]);
    }
  }

  const roots = [...rootIds].map((rootId) => {
    const ownTotal = own.get(rootId) ?? 0;
    const childIds = (childrenByRoot.get(rootId) ?? []).sort(
      (a, b) => (own.get(b) ?? 0) - (own.get(a) ?? 0),
    );
    const childSum = childIds.reduce((s, c) => s + (own.get(c) ?? 0), 0);
    return { rootId, ownTotal, childIds, rolledTotal: ownTotal + childSum };
  });
  roots.sort((a, b) => b.rolledTotal - a.rolledTotal);

  const out: CategoryHierarchyNode[] = [];
  for (const { rootId, ownTotal, childIds, rolledTotal } of roots) {
    out.push({
      id: rootId,
      parentId: null,
      nameEs: nameOf(rootId),
      color: colorOf(rootId),
      isLeaf: childIds.length === 0,
      childIds,
      ownTotal,
      rolledTotal,
    });
    for (const childId of childIds) {
      const cOwn = own.get(childId) ?? 0;
      out.push({
        id: childId,
        parentId: rootId,
        nameEs: nameOf(childId),
        color: colorOf(childId),
        isLeaf: true,
        childIds: [],
        ownTotal: cOwn,
        rolledTotal: cOwn,
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
      "id, transaction_date, amount, direction, currency_code, merchant_name, clean_description, account:accounts!transactions_account_id_fkey!inner(name)",
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
    .is("transfer_group_id", null)
    .or("personal_debt_id.is.null,pd_role.neq.origin")
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
      amount: Number(t.amount),
      currencyCode: (t.currency_code ?? currency) as CurrencyCode,
      direction: t.direction as "INFLOW" | "OUTFLOW",
      accountLabel: account?.name ?? "Cuenta",
    };
  });
}
