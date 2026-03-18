"use server";

import { cacheTag, cacheLife, revalidateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { executeVisibleTransactionQuery } from "@/lib/utils/transactions";
import { categorySchema } from "@/lib/validators/category";
import type { ActionResult } from "@/types/actions";
import { parseMonth, monthStartStr, monthEndStr, monthsBeforeStart } from "@/lib/utils/date";
import type { Category, CategoryWithChildren, CategoryWithBudget, CategoryBudgetData, TransactionDirection, CurrencyCode } from "@/types/domain";

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
  direction?: TransactionDirection
): Promise<CategoryWithChildren[]> {
  "use cache";
  cacheTag("categories");
  cacheLife("zeta");

  const supabase = createAdminClient()!;

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
  direction?: TransactionDirection
): Promise<CategoryWithBudget[]> {
  "use cache";
  cacheTag("categories");
  cacheLife("zeta");

  const supabase = createAdminClient()!;

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
  userId: string
): Promise<CategoryBudgetData[]> {
  "use cache";
  cacheTag("categories");
  cacheLife("zeta");

  const supabase = createAdminClient()!;

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
    spent: 0,
    committedRecurring: 0,
    percentUsed: 0,
    average3m: 0,
    children: childrenByParent.get(cat.id) ?? [],
  }));

  return result;
}

async function getCategoryTransactionCountCached(
  userId: string,
  categoryId: string
): Promise<number> {
  "use cache";
  cacheTag("categories");
  cacheLife("zeta");

  const supabase = createAdminClient()!;

  const { count, error } = await executeVisibleTransactionQuery(() =>
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("category_id", categoryId)
  );

  if (error) throw error;
  return count ?? 0;
}

async function getCategoriesWithBudgetDataCached(
  userId: string,
  month?: string,
  currency?: CurrencyCode
): Promise<CategoryBudgetData[]> {
  "use cache";
  cacheTag("categories");
  cacheTag("budgets");
  cacheTag("dashboard:charts");
  cacheTag("dashboard:budgets");
  cacheLife("zeta");

  const supabase = createAdminClient()!;
  const baseCurrency = currency ?? "COP";
  const target = parseMonth(month);

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
      .eq("period", "monthly"),

    // 3. This month's spending
    executeVisibleTransactionQuery(() =>
      supabase
        .from("transactions")
        .select("amount, category_id")
        .eq("direction", "OUTFLOW")
        .eq("is_excluded", false)
        .eq("currency_code", baseCurrency)
        .gte("transaction_date", monthStartStr(target))
        .lte("transaction_date", monthEndStr(target))
    ),

    // 4. Last 3 months spending for averages
    executeVisibleTransactionQuery(() =>
      supabase
        .from("transactions")
        .select("amount, category_id, transaction_date")
        .eq("direction", "OUTFLOW")
        .eq("is_excluded", false)
        .eq("currency_code", baseCurrency)
        .gte("transaction_date", monthsBeforeStart(target, 3))
        .lt("transaction_date", monthStartStr(target))
    ),

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

  // Build spent map (this month)
  const spentMap = new Map<string, number>();
  for (const tx of spentRes.data ?? []) {
    if (tx.category_id) {
      spentMap.set(tx.category_id, (spentMap.get(tx.category_id) ?? 0) + tx.amount);
    }
  }

  // Build 3-month total map (divide by 3 for average)
  const avgTotalMap = new Map<string, number>();
  for (const tx of avgRes.data ?? []) {
    if (tx.category_id) {
      avgTotalMap.set(tx.category_id, (avgTotalMap.get(tx.category_id) ?? 0) + tx.amount);
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
    const budget = budgetMap.get(cat.id) ?? null;
    const spent = spentMap.get(cat.id) ?? 0;
    const avg3mTotal = avgTotalMap.get(cat.id) ?? 0;
    const committedRecurring = recurringMap.get(cat.id) ?? 0;

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
      budget,
      spent,
      committedRecurring,
      percentUsed: budget && budget > 0 ? (spent / budget) * 100 : 0,
      average3m: avg3mTotal / 3,
      children: childrenByParent.get(cat.id) ?? [],
    };
  });

  return result;
}

// ─── Public wrappers ──────────────────────────────────────────────────────────

export async function getCategories(
  direction?: TransactionDirection
): Promise<ActionResult<CategoryWithChildren[]>> {
  const { user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  try {
    const data = await getCategoriesCached(user.id, direction);
    return { success: true, data };
  } catch {
    return { success: false, error: "Error al cargar las categorías" };
  }
}

export async function getCategoriesWithBudgets(
  direction?: TransactionDirection
): Promise<ActionResult<CategoryWithBudget[]>> {
  const { user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  try {
    const data = await getCategoriesWithBudgetsCached(user.id, direction);
    return { success: true, data };
  } catch {
    return { success: false, error: "Error al cargar las categorías" };
  }
}

export async function getAllCategoriesForManagement(): Promise<
  ActionResult<CategoryBudgetData[]>
> {
  const { user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  try {
    const data = await getAllCategoriesForManagementCached(user.id);
    return { success: true, data };
  } catch {
    return { success: false, error: "Error al cargar las categorías" };
  }
}

export async function getCategoryTransactionCount(
  categoryId: string
): Promise<ActionResult<number>> {
  const { user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  try {
    const data = await getCategoryTransactionCountCached(user.id, categoryId);
    return { success: true, data };
  } catch {
    return { success: false, error: "Error al cargar el conteo" };
  }
}

export async function getCategoriesWithBudgetData(
  month?: string,
  currency?: CurrencyCode
): Promise<ActionResult<CategoryBudgetData[]>> {
  const { user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  try {
    const data = await getCategoriesWithBudgetDataCached(user.id, month, currency);
    return { success: true, data };
  } catch {
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

  revalidateTag("categories", "zeta");
  revalidateTag("budgets", "zeta");
  revalidateTag("dashboard:charts", "zeta");
  revalidateTag("dashboard:budgets", "zeta");
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

  revalidateTag("categories", "zeta");
  revalidateTag("budgets", "zeta");
  revalidateTag("dashboard:charts", "zeta");
  revalidateTag("dashboard:budgets", "zeta");
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

  revalidateTag("categories", "zeta");
  revalidateTag("budgets", "zeta");
  revalidateTag("dashboard:charts", "zeta");
  revalidateTag("dashboard:budgets", "zeta");
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

  revalidateTag("categories", "zeta");
  revalidateTag("budgets", "zeta");
  revalidateTag("dashboard:charts", "zeta");
  revalidateTag("dashboard:budgets", "zeta");
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

  revalidateTag("categories", "zeta");
  revalidateTag("budgets", "zeta");
  revalidateTag("dashboard:charts", "zeta");
  revalidateTag("dashboard:budgets", "zeta");
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

  revalidateTag("categories", "zeta");
  revalidateTag("budgets", "zeta");
  revalidateTag("dashboard:charts", "zeta");
  revalidateTag("dashboard:budgets", "zeta");
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

  revalidateTag("categories", "zeta");
  revalidateTag("budgets", "zeta");
  revalidateTag("dashboard:charts", "zeta");
  revalidateTag("dashboard:budgets", "zeta");
  return { success: true, data: undefined };
}
