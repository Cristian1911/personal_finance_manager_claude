"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { executeVisibleTransactionQuery } from "@/lib/utils/transactions";
import { categorySchema } from "@/lib/validators/category";
import type { ActionResult } from "@/types/actions";
import { parseMonth, monthStartStr, monthEndStr, monthsBeforeStart } from "@/lib/utils/date";
import type { Category, CategoryWithChildren, CategoryWithBudget, CategoryBudgetData, TransactionDirection } from "@/types/domain";

export async function getCategories(
  direction?: TransactionDirection
): Promise<ActionResult<CategoryWithChildren[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  let query = supabase
    .from("categories")
    .select("*")
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (direction) {
    query = query.or(`direction.eq.${direction},direction.is.null`);
  }

  const { data, error } = await query;

  if (error) return { success: false, error: error.message };

  // Build tree structure
  const categories = data ?? [];
  const tree = buildCategoryTree(categories);

  return { success: true, data: tree };
}

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

export async function getCategoriesWithBudgets(
  direction?: TransactionDirection
): Promise<ActionResult<CategoryWithBudget[]>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  let query = supabase
    .from("categories")
    .select("*")
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (direction) {
    query = query.or(`direction.eq.${direction},direction.is.null`);
  }

  const { data: categories, error } = await query;
  if (error) return { success: false, error: error.message };

  const { data: budgets } = await supabase
    .from("budgets")
    .select("category_id, amount, period")
    .eq("user_id", user.id)
    .eq("period", "monthly");

  const budgetByCategory = new Map<string, number>();
  for (const b of budgets ?? []) {
    budgetByCategory.set(b.category_id, Number(b.amount));
  }

  const allCategories = categories ?? [];
  const tree = buildCategoryTreeWithBudgets(allCategories, budgetByCategory);
  return { success: true, data: tree };
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

export async function createCategory(
  _prevState: ActionResult<Category>,
  formData: FormData
): Promise<ActionResult<Category>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  revalidatePath("/categories");
  return { success: true, data };
}

export async function updateCategory(
  id: string,
  _prevState: ActionResult<Category>,
  formData: FormData
): Promise<ActionResult<Category>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  revalidatePath("/categories");
  return { success: true, data };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("user_id", user.id)
    .eq("id", id)
    .eq("is_system", false);

  if (error) return { success: false, error: error.message };

  revalidatePath("/categories");
  return { success: true, data: undefined };
}

export async function updateCategoryOrder(
  items: { id: string; display_order: number; parent_id: string | null }[]
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  revalidatePath("/categories");
  return { success: true, data: undefined };
}

export async function getCategoryTransactionCount(
  categoryId: string
): Promise<ActionResult<number>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const { count, error } = await executeVisibleTransactionQuery(() =>
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("category_id", categoryId)
  );

  if (error) return { success: false, error: error.message };
  return { success: true, data: count ?? 0 };
}

export async function reassignAndDeleteCategory(
  id: string,
  reassignToCategoryId?: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
    .eq("id", id);

  if (deleteError) return { success: false, error: deleteError.message };

  revalidatePath("/categories");
  revalidatePath("/categories/manage");
  return { success: true, data: undefined };
}

export async function getCategoriesWithBudgetData(
  month?: string
): Promise<ActionResult<CategoryBudgetData[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const target = parseMonth(month);

  const [catRes, budgetRes, spentRes, avgRes] = await Promise.all([
    // 1. Parent categories only
    supabase
      .from("categories")
      .select("*")
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .eq("is_active", true)
      .is("parent_id", null)
      .order("display_order", { ascending: true }),

    // 2. Budgets
    supabase
      .from("budgets")
      .select("category_id, amount")
      .eq("user_id", user.id)
      .eq("period", "monthly"),

    // 3. This month's spending
    executeVisibleTransactionQuery(() =>
      supabase
        .from("transactions")
        .select("amount, category_id")
        .eq("direction", "OUTFLOW")
        .eq("is_excluded", false)
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
        .gte("transaction_date", monthsBeforeStart(target, 2))
        .lt("transaction_date", monthStartStr(target))
    ),
  ]);

  if (catRes.error) return { success: false, error: catRes.error.message };

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

  // Fetch children for each parent
  const { data: allChildren } = await supabase
    .from("categories")
    .select("*")
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .eq("is_active", true)
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

  const categories = catRes.data ?? [];

  const result: CategoryBudgetData[] = categories.map((cat) => {
    const budget = budgetMap.get(cat.id) ?? null;
    const spent = spentMap.get(cat.id) ?? 0;
    const avg3mTotal = avgTotalMap.get(cat.id) ?? 0;

    return {
      id: cat.id,
      name: cat.name,
      name_es: cat.name_es,
      slug: cat.slug,
      icon: cat.icon,
      color: cat.color,
      is_essential: cat.is_essential ?? false,
      direction: cat.direction as TransactionDirection,
      budget,
      spent,
      percentUsed: budget && budget > 0 ? (spent / budget) * 100 : 0,
      average3m: avg3mTotal / 3,
      children: childrenByParent.get(cat.id) ?? [],
    };
  });

  return { success: true, data: result };
}
