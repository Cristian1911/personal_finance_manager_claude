"use server";

import { cacheTag, cacheLife, updateTag } from "next/cache";
import { revalidateFinancialViews } from "@/lib/cache/revalidation";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { categorySchema } from "@/lib/validators/category";
import { getIsDemoFilter, getDemoAccountIds } from "@/lib/demo-filter";
import type { ActionResult } from "@/types/actions";
import { parseMonth, monthStartStr, monthEndStr, monthsBeforeStart } from "@/lib/utils/date";
import { rollupGroup } from "@/lib/utils/budget-rollup";
import type { Category, CategoryWithChildren, CategoryWithBudget, CategoryBudgetData, TransactionDirection, CurrencyCode } from "@/types/domain";
import {
  COUNTED_FLOW_CLASSES,
  countedFlowClassesForCategories,
} from "@zeta/shared";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildCategoryTree(categories: Category[]): CategoryWithChildren[] {
  const map = new Map<string, CategoryWithChildren>();
  const roots: CategoryWithChildren[] = [];

  // First pass: create map entries
  for (const cat of categories) {
    map.set(cat.id, { ...cat, children: [] });
  }

  // Second pass: build tree
  for (const cat of categories) {
    const node = map.get(cat.id)!;
    if (cat.parent_id && map.has(cat.parent_id)) {
      map.get(cat.parent_id)!.children.push(node);
    } else if (!cat.parent_id) {
      roots.push(node);
    }
  }

  return roots;
}

function buildCategoryTreeWithBudgets(
  categories: Category[],
  budgetByCategory: Map<string, number>
): CategoryWithBudget[] {
  const map = new Map<string, CategoryWithBudget>();
  const roots: CategoryWithBudget[] = [];

  for (const cat of categories) {
    map.set(cat.id, { ...cat, children: [], childBudgetTotal: 0 });
  }

  for (const cat of categories) {
    const node = map.get(cat.id)!;
    if (cat.parent_id && map.has(cat.parent_id)) {
      map.get(cat.parent_id)!.children.push(node);
    } else if (!cat.parent_id) {
      roots.push(node);
    }
  }

  // Compute parent totals after tree is built
  for (const root of roots) {
    root.childBudgetTotal = root.children.reduce(
      (sum, child) => sum + (budgetByCategory.get(child.id) ?? 0),
      0
    );
  }

  return roots;
}

// ─── Cached inner functions ───────────────────────────────────────────────────

async function getCategoriesCached(
  userId: string,
  accessToken: string,
  direction?: TransactionDirection
): Promise<CategoryWithChildren[]> {
  "use cache";
  cacheTag("categories");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  let query = supabase
    .from("categories")
    .select("*")
    .or(`user_id.eq.${userId},user_id.is.null`)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (direction) {
    query = query.or(`direction.eq.${direction},direction.is.null`);
  }

  const { data, error } = await query;

  if (error) throw error;

  const categories = data ?? [];
  return buildCategoryTree(categories);
}

async function getCategoriesWithBudgetsCached(
  userId: string,
  accessToken: string,
  direction?: TransactionDirection
): Promise<CategoryWithBudget[]> {
  "use cache";
  cacheTag("categories");
  cacheTag("budgets");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  let query = supabase
    .from("categories")
    .select("*")
    .or(`user_id.eq.${userId},user_id.is.null`)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (direction) {
    query = query.or(`direction.eq.${direction},direction.is.null`);
  }

  const { data: categories, error } = await query;
  if (error) throw error;

  const { data: budgets } = await supabase
    .from("budgets")
    .select("category_id, amount, period")
    .eq("user_id", userId)
    .eq("period", "monthly");

  const budgetByCategory = new Map<string, number>();
  for (const b of budgets ?? []) {
    budgetByCategory.set(b.category_id, Number(b.amount));
  }

  const allCategories = categories ?? [];
  return buildCategoryTreeWithBudgets(allCategories, budgetByCategory);
}

async function getAllCategoriesForManagementCached(
  userId: string,
  accessToken: string
): Promise<CategoryBudgetData[]> {
  "use cache";
  cacheTag("categories");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  // Fetch ALL parent categories (including inactive) for management
  const { data: parents, error } = await supabase
    .from("categories")
    .select("*")
    .or(`user_id.eq.${userId},user_id.is.null`)
    .is("parent_id", null)
    .order("direction", { ascending: true })
    .order("display_order", { ascending: true });

  if (error) throw error;

  // Fetch all children (including inactive parents' children)
  const { data: allChildren } = await supabase
    .from("categories")
    .select("*")
    .or(`user_id.eq.${userId},user_id.is.null`)
    .not("parent_id", "is", null)
    .order("display_order", { ascending: true });

  const childrenByParent = new Map<string, CategoryWithChildren[]>();
  for (const child of allChildren ?? []) {
    if (child.parent_id) {
      const arr = childrenByParent.get(child.parent_id) ?? [];
      arr.push({ ...child, children: [] });
      childrenByParent.set(child.parent_id, arr);
    }
  }

  const result: CategoryBudgetData[] = (parents ?? []).map((cat) => ({
    id: cat.id,
    name: cat.name,
    name_es: cat.name_es,
    slug: cat.slug,
    icon: cat.icon,
    color: cat.color,
    is_essential: cat.is_essential ?? false,
    is_active: cat.is_active ?? true,
    direction: cat.direction as TransactionDirection,
    expense_type: (cat.expense_type as "fixed" | "variable") ?? null,
    budget: null,
    baseBudget: null,
    spent: 0,
    committedRecurring: 0,
    percentUsed: 0,
    average3m: 0,
    children: childrenByParent.get(cat.id) ?? [],
    childrenSpent: {},
    childBudgets: {},
    childAvg3m: {},
    childRecurring: {},
  }));

  return result;
}

async function getCategoryTransactionCountCached(
  userId: string,
  accessToken: string,
  categoryId: string
): Promise<number> {
  "use cache";
  cacheTag("categories");
  cacheTag("transactions");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  const { count, error } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("category_id", categoryId)
    .is("reconciled_into_transaction_id", null);

  if (error) throw error;
  return count ?? 0;
}

async function getCategoriesWithBudgetDataCached(
  userId: string,
  accessToken: string,
  month?: string,
  currency?: CurrencyCode,
  // Explicit param (not resolved inside) so demo mode produces its own cache
  // key — otherwise toggling it would serve the other mode's numbers.
  isDemo = false,
): Promise<CategoryBudgetData[]> {
  "use cache";
  cacheTag("categories");
  cacheTag("budgets");
  cacheTag("transactions");
  cacheTag("recurring");
  cacheTag("dashboard:charts");
  cacheTag("dashboard:budgets");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const baseCurrency = currency ?? "COP";
  const target = parseMonth(month);
  // Scope spend to the same accounts getBudgetSummary uses (active + matching
  // demo mode); without it this grid counted spend from deactivated accounts
  // and from the other demo mode, so it never matched the budget bar.
  const spendAccountIds = await getDemoAccountIds(supabase, userId, isDemo);

  // The grid is scoped to every category, so it always includes the allocation
  // ones. Shared with getBudgetSummary deliberately: those two are documented
  // as having to agree, and they reported different "gastado" for the same
  // month once already because the rule was spelled out twice.
  const gridCountedClasses = countedFlowClassesForCategories(COUNTED_FLOW_CLASSES, null);

  const [catRes, budgetRes, spentRes, avgRes, recurringRes, childrenRes] = await Promise.all([
    // 1. Parent categories only
    supabase
      .from("categories")
      .select("*")
      .or(`user_id.eq.${userId},user_id.is.null`)
      .eq("is_active", true)
      .is("parent_id", null)
      .order("display_order", { ascending: true }),

    // 2. Budgets
    supabase
      .from("budgets")
      .select("category_id, amount")
      .eq("user_id", userId)
      // Demo and real budget rows must not mix, same as getBudgetSummary.
      .eq("is_demo", isDemo)
      .eq("period", "monthly"),

    // 3. This month's spending.
    // Same exclusions as getBudgetSummary (budgets.ts): transfers are not
    // spending, personal-debt movements are not spending, and a shared
    // payment's spend is amount − split_repaid_amount. Without them this grid
    // and the budget bar on the dashboard reported different "gastado" for the
    // same month.
    supabase
      .from("transactions")
      .select("amount, category_id, split_repaid_amount")
      .eq("user_id", userId)
      .eq("direction", "OUTFLOW")
      .eq("is_excluded", false)
      .eq("currency_code", baseCurrency)
      .gte("transaction_date", monthStartStr(target))
      .lte("transaction_date", monthEndStr(target))
      .is("reconciled_into_transaction_id", null)
      .in("flow_class_effective", gridCountedClasses)
      .is("personal_debt_id", null)
      .in("account_id", spendAccountIds ?? []),

    // 4. Last 3 months spending for averages (same exclusions as query 3, or
    // the averages drift away from the current month's number)
    supabase
      .from("transactions")
      .select("amount, category_id, transaction_date, split_repaid_amount")
      .eq("user_id", userId)
      .eq("direction", "OUTFLOW")
      .eq("is_excluded", false)
      .eq("currency_code", baseCurrency)
      .gte("transaction_date", monthsBeforeStart(target, 3))
      .lt("transaction_date", monthStartStr(target))
      .is("reconciled_into_transaction_id", null)
      .in("flow_class_effective", gridCountedClasses)
      .is("personal_debt_id", null)
      .in("account_id", spendAccountIds ?? []),

    // 5. Active recurring templates (monthly committed amounts per category)
    supabase
      .from("recurring_transaction_templates")
      .select("category_id, amount")
      .eq("user_id", userId)
      .eq("is_active", true)
      .eq("direction", "OUTFLOW")
      .eq("currency_code", baseCurrency),

    // 6. Children categories (independent of other queries)
    supabase
      .from("categories")
      .select("*")
      .or(`user_id.eq.${userId},user_id.is.null`)
      .eq("is_active", true)
      .not("parent_id", "is", null)
      .order("display_order", { ascending: true }),
  ]);

  if (catRes.error) throw catRes.error;

  // Build budget map
  const budgetMap = new Map<string, number>();
  for (const b of budgetRes.data ?? []) {
    budgetMap.set(b.category_id, Number(b.amount));
  }

  // Build spent map (this month). Effective spend nets what participants of a
  // shared payment already paid back — same rule as budgets.ts and charts.ts.
  const effectiveSpend = (tx: { amount: number; split_repaid_amount?: number | null }) =>
    Number(tx.amount) - Number(tx.split_repaid_amount ?? 0);

  const spentMap = new Map<string, number>();
  for (const tx of spentRes.data ?? []) {
    if (tx.category_id) {
      spentMap.set(tx.category_id, (spentMap.get(tx.category_id) ?? 0) + effectiveSpend(tx));
    }
  }

  // Build 3-month total map (divide by 3 for average)
  const avgTotalMap = new Map<string, number>();
  for (const tx of avgRes.data ?? []) {
    if (tx.category_id) {
      avgTotalMap.set(tx.category_id, (avgTotalMap.get(tx.category_id) ?? 0) + effectiveSpend(tx));
    }
  }

  // Build recurring committed map (sum of active recurring templates per category)
  const recurringMap = new Map<string, number>();
  for (const tmpl of recurringRes.data ?? []) {
    if (tmpl.category_id) {
      recurringMap.set(tmpl.category_id, (recurringMap.get(tmpl.category_id) ?? 0) + tmpl.amount);
    }
  }

  const allChildren = childrenRes.data;

  const childrenByParent = new Map<string, CategoryWithChildren[]>();
  for (const child of allChildren ?? []) {
    if (child.parent_id) {
      const arr = childrenByParent.get(child.parent_id) ?? [];
      arr.push({ ...child, children: [] });
      childrenByParent.set(child.parent_id, arr);
    }
  }

  const categories = catRes.data ?? [];

  const result: CategoryBudgetData[] = categories.map((cat) => {
    const baseBudget = budgetMap.get(cat.id) ?? null;
    const spent = spentMap.get(cat.id) ?? 0;
    const avg3mTotal = avgTotalMap.get(cat.id) ?? 0;

    const children = childrenByParent.get(cat.id) ?? [];
    const childrenSpent: Record<string, number> = {};
    const childBudgets: Record<string, number> = {};
    const childAvg3m: Record<string, number> = {};
    const childRecurring: Record<string, number> = {};
    let childRecurringTotal = 0;
    let childAvg3mTotal = 0;

    for (const child of children) {
      const childSpent = spentMap.get(child.id) ?? 0;
      if (childSpent > 0) childrenSpent[child.id] = childSpent;

      const childBudget = budgetMap.get(child.id) ?? 0;
      if (childBudget > 0) childBudgets[child.id] = childBudget;

      const childAvgTotal = avgTotalMap.get(child.id) ?? 0;
      if (childAvgTotal > 0) {
        childAvg3m[child.id] = childAvgTotal / 3;
        childAvg3mTotal += childAvgTotal;
      }

      const childRec = recurringMap.get(child.id) ?? 0;
      if (childRec > 0) {
        childRecurring[child.id] = childRec;
        childRecurringTotal += childRec;
      }
    }

    const rollup = rollupGroup({
      baseBudget,
      childBudgets,
      parentSpent: spent,
      childrenSpent,
    });

    return {
      id: cat.id,
      name: cat.name,
      name_es: cat.name_es,
      slug: cat.slug,
      icon: cat.icon,
      color: cat.color,
      is_essential: cat.is_essential ?? false,
      is_active: cat.is_active ?? true,
      direction: cat.direction as TransactionDirection,
      expense_type: (cat.expense_type as "fixed" | "variable") ?? null,
      budget: rollup.totalBudget,
      baseBudget,
      spent: rollup.totalSpent,
      committedRecurring: (recurringMap.get(cat.id) ?? 0) + childRecurringTotal,
      percentUsed: rollup.percentUsed,
      average3m: (avg3mTotal + childAvg3mTotal) / 3,
      children,
      childrenSpent,
      childBudgets,
      childAvg3m,
      childRecurring,
    };
  });

  return result;
}

// ─── Public wrappers ──────────────────────────────────────────────────────────

export async function getCategories(
  direction?: TransactionDirection
): Promise<ActionResult<CategoryWithChildren[]>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  try {
    const data = await getCategoriesCached(user.id, accessToken, direction);
    return { success: true, data };
  } catch (error) {
    console.error("Error loading categories:", error);
    return { success: false, error: "Error al cargar las categorías" };
  }
}

export async function getCategoriesWithBudgets(
  direction?: TransactionDirection
): Promise<ActionResult<CategoryWithBudget[]>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  try {
    const data = await getCategoriesWithBudgetsCached(user.id, accessToken, direction);
    return { success: true, data };
  } catch (error) {
    console.error("Error loading categories:", error);
    return { success: false, error: "Error al cargar las categorías" };
  }
}

export async function getAllCategoriesForManagement(): Promise<
  ActionResult<CategoryBudgetData[]>
> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  try {
    const data = await getAllCategoriesForManagementCached(user.id, accessToken);
    return { success: true, data };
  } catch (error) {
    console.error("Error loading categories:", error);
    return { success: false, error: "Error al cargar las categorías" };
  }
}

export async function getCategoryTransactionCount(
  categoryId: string
): Promise<ActionResult<number>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  try {
    const data = await getCategoryTransactionCountCached(user.id, accessToken, categoryId);
    return { success: true, data };
  } catch (error) {
    console.error("Error loading category count:", error);
    return { success: false, error: "Error al cargar el conteo" };
  }
}

export async function getCategoriesWithBudgetData(
  month?: string,
  currency?: CurrencyCode
): Promise<ActionResult<CategoryBudgetData[]>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  try {
    const isDemo = await getIsDemoFilter(user.id);
    const data = await getCategoriesWithBudgetDataCached(
      user.id,
      accessToken,
      month,
      currency,
      isDemo,
    );
    return { success: true, data };
  } catch (error) {
    console.error("Error loading budget data:", error);
    return { success: false, error: "Error al cargar los datos de presupuesto" };
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createCategory(
  _prevState: ActionResult<Category>,
  formData: FormData
): Promise<ActionResult<Category>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    name_es: formData.get("name_es") || undefined,
    slug: formData.get("slug"),
    icon: formData.get("icon") || "tag",
    color: formData.get("color") || "#6b7280",
    direction: formData.get("direction") || undefined,
    parent_id: formData.get("parent_id") || undefined,
    is_essential: formData.get("is_essential") === "true",
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({
      user_id: user.id,
      is_system: false,
      ...parsed.data,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  updateTag("categories");
  updateTag("budgets");
  updateTag("dashboard:charts");
  updateTag("dashboard:budgets");
  updateTag("attention");
  return { success: true, data };
}

export async function updateCategory(
  id: string,
  _prevState: ActionResult<Category>,
  formData: FormData
): Promise<ActionResult<Category>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    name_es: formData.get("name_es") || undefined,
    slug: formData.get("slug"),
    icon: formData.get("icon") || "tag",
    color: formData.get("color") || "#6b7280",
    direction: formData.get("direction") || undefined,
    parent_id: formData.get("parent_id") || undefined,
    is_essential: formData.get("is_essential") === "true",
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { data, error } = await supabase
    .from("categories")
    .update(parsed.data)
    .eq("user_id", user.id)
    .eq("id", id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  updateTag("categories");
  updateTag("budgets");
  updateTag("dashboard:charts");
  updateTag("dashboard:budgets");
  updateTag("attention");
  return { success: true, data };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("user_id", user.id)
    .eq("id", id)
    .eq("is_system", false);

  if (error) return { success: false, error: error.message };

  revalidateFinancialViews();
  updateTag("categories");
  return { success: true, data: undefined };
}

export async function updateCategoryOrder(
  items: { id: string; display_order: number; parent_id: string | null }[]
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // Supabase doesn't have an easy bulk update via RPC without custom functions
  // but for small amounts of categories we can update them in a loop
  // A transaction isn't strictly necessary for display ordering if it fails midway,
  // but Promise.all acts quickly.

  const updates = items.map((item) =>
    supabase
      .from("categories")
      .update({
        display_order: item.display_order,
        parent_id: item.parent_id,
      })
      .eq("user_id", user.id)
      .eq("id", item.id)
  );

  const results = await Promise.all(updates);

  const hasError = results.some((r) => r.error);
  if (hasError) {
    return { success: false, error: "Error actualizando el orden de las categorías" };
  }

  updateTag("categories");
  updateTag("budgets");
  updateTag("dashboard:charts");
  updateTag("dashboard:budgets");
  updateTag("attention");
  return { success: true, data: undefined };
}

export async function updateCategoryExpenseType(
  categoryId: string,
  expenseType: "fixed" | "variable" | null
): Promise<ActionResult<undefined>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("categories")
    .update({ expense_type: expenseType })
    .eq("id", categoryId)
    .or(`user_id.eq.${user.id},is_system.eq.true`);

  if (error) return { success: false, error: error.message };

  updateTag("categories");
  updateTag("budgets");
  updateTag("dashboard:charts");
  updateTag("dashboard:budgets");
  updateTag("attention");
  return { success: true, data: undefined };
}

export async function reassignAndDeleteCategory(
  id: string,
  reassignToCategoryId?: string
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // Reassign transactions if target provided
  if (reassignToCategoryId) {
    const { error: reassignError } = await supabase
      .from("transactions")
      .update({ category_id: reassignToCategoryId })
      .eq("user_id", user.id)
      .is("reconciled_into_transaction_id", null)
      .eq("category_id", id);

    if (reassignError) return { success: false, error: reassignError.message };
  }

  // Note: Two-step operation (reassign then delete) is intentionally non-atomic.
  // RLS enforces ownership on the category delete.
  const { error: deleteError } = await supabase
    .from("categories")
    .delete()
    .eq("user_id", user.id)
    .eq("id", id);

  if (deleteError) return { success: false, error: deleteError.message };

  revalidateFinancialViews();
  updateTag("categories");
  return { success: true, data: undefined };
}

export async function toggleCategoryActive(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("categories")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  updateTag("categories");
  updateTag("budgets");
  updateTag("dashboard:charts");
  updateTag("dashboard:budgets");
  updateTag("attention");
  return { success: true, data: undefined };
}

// ─── Rhythm view ──────────────────────────────────────────────────────────────

export type RhythmCategoryData = {
  id: string;
  name: string;
  name_es: string | null;
  spent: number;
  budget: number | null;
};

export type RhythmGroup = {
  rhythmTag: string;
  color: string;
  categories: RhythmCategoryData[];
};

const RITMO_GROUP_ID = "d0000001-0001-4000-8000-000000000001";

export async function getCategoriesByRhythm(
  month?: string,
  currency: CurrencyCode = "COP"
): Promise<ActionResult<RhythmGroup[]>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  try {
    const target = parseMonth(month);
    const baseCurrency = currency;

    // Fetch Ritmo tags
    const { data: ritmoTags } = await supabase
      .from("tags")
      .select("id, name, color, group_id")
      .eq("group_id", RITMO_GROUP_ID);

    if (!ritmoTags || ritmoTags.length === 0) {
      return { success: true, data: [] };
    }

    // Fetch subcategory → tag links for Ritmo tags
    const { data: categoryTagLinks } = await supabase
      .from("category_tags")
      .select("category_id, tag_id")
      .in(
        "tag_id",
        ritmoTags.map((t) => t.id)
      );

    if (!categoryTagLinks || categoryTagLinks.length === 0) {
      return { success: true, data: [] };
    }

    const taggedCategoryIds = categoryTagLinks.map((l) => l.category_id);

    const [{ data: categories }, { data: budgets }, { data: spentRows }] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name, name_es")
        .in("id", taggedCategoryIds)
        .eq("is_active", true),

      supabase
        .from("budgets")
        .select("category_id, amount")
        .eq("user_id", user.id)
        .eq("period", "monthly")
        .in("category_id", taggedCategoryIds),

      supabase
        .from("transactions")
        .select("amount, category_id")
        .eq("user_id", user.id)
        .eq("direction", "OUTFLOW")
        .eq("is_excluded", false)
        .eq("currency_code", baseCurrency)
        .gte("transaction_date", monthStartStr(target))
        .lte("transaction_date", monthEndStr(target))
        .is("reconciled_into_transaction_id", null)
        .in("category_id", taggedCategoryIds),
    ]);

    // Build lookup maps
    const budgetMap = new Map<string, number>();
    for (const b of budgets ?? []) {
      budgetMap.set(b.category_id, Number(b.amount));
    }

    const spentMap = new Map<string, number>();
    for (const tx of spentRows ?? []) {
      if (tx.category_id) {
        spentMap.set(tx.category_id, (spentMap.get(tx.category_id) ?? 0) + tx.amount);
      }
    }

    // Build category id → Ritmo tag map
    const categoryRitmoMap = new Map<string, { name: string; color: string }>();
    for (const link of categoryTagLinks) {
      const tag = ritmoTags.find((t) => t.id === link.tag_id);
      if (tag) {
        categoryRitmoMap.set(link.category_id, {
          name: tag.name,
          color: tag.color ?? "#818cf8",
        });
      }
    }

    // Group categories by Ritmo tag
    const rhythmGroups = new Map<string, { color: string; categories: RhythmCategoryData[] }>();
    for (const cat of categories ?? []) {
      const rhythm = categoryRitmoMap.get(cat.id);
      if (!rhythm) continue;

      if (!rhythmGroups.has(rhythm.name)) {
        rhythmGroups.set(rhythm.name, { color: rhythm.color, categories: [] });
      }
      rhythmGroups.get(rhythm.name)!.categories.push({
        id: cat.id,
        name: cat.name,
        name_es: cat.name_es,
        spent: spentMap.get(cat.id) ?? 0,
        budget: budgetMap.get(cat.id) ?? null,
      });
    }

    // Return groups in the order the Ritmo tags appear
    const tagOrder = ritmoTags.map((t) => t.name);
    const result: RhythmGroup[] = tagOrder
      .filter((name) => rhythmGroups.has(name))
      .map((name) => ({
        rhythmTag: name,
        color: rhythmGroups.get(name)!.color,
        categories: rhythmGroups.get(name)!.categories,
      }));

    return { success: true, data: result };
  } catch (error) {
    console.error("Error loading rhythm data:", error);
    return { success: false, error: "Error al cargar los datos de ritmo" };
  }
}
