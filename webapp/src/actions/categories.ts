"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { categorySchema } from "@/lib/validators/category";
import type { ActionResult } from "@/types/actions";
import type { Category, CategoryWithChildren, TransactionDirection } from "@/types/domain";

export async function getCategories(
  direction?: TransactionDirection
): Promise<ActionResult<CategoryWithChildren[]>> {
  const supabase = await createClient();

  let query = supabase
    .from("categories")
    .select("*")
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
    .eq("id", id)
    .eq("is_system", false)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/categories");
  return { success: true, data };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("categories")
    .delete()
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
