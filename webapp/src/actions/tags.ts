"use server";

import { cache } from "react";
import { revalidateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { tagGroupSchema, tagSchema, generateSlug } from "@/lib/validators/tags";
import type { ActionResult } from "@/types/actions";
import type { TagGroupWithTags, Tag, TaggableEntity } from "@/types/domain";

// ── Queries ───────────────────────────────────────────────

export const getTagGroups = cache(async (): Promise<ActionResult<TagGroupWithTags[]>> => {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: groups, error: groupsError } = await supabase
    .from("tag_groups")
    .select("*")
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .order("display_order");

  if (groupsError) return { success: false, error: groupsError.message };

  const { data: tags, error: tagsError } = await supabase
    .from("tags")
    .select("*")
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .order("display_order");

  if (tagsError) return { success: false, error: tagsError.message };

  const groupsWithTags: TagGroupWithTags[] = groups.map((g) => ({
    ...g,
    tags: tags.filter((t) => t.group_id === g.id),
  }));

  return { success: true, data: groupsWithTags };
});

export const getTagsForEntity = cache(
  async (entityType: TaggableEntity, entityId: string): Promise<Tag[]> => {
    const { supabase, user } = await getAuthenticatedClient();
    if (!user) return [];

    const tableName = `${entityType}_tags` as const;
    const idColumn = `${entityType}_id` as const;

    const { data } = await supabase
      .from(tableName)
      .select("tag_id")
      .eq(idColumn, entityId);

    if (!data || data.length === 0) return [];

    const tagIds = data.map((r: { tag_id: string }) => r.tag_id);
    const { data: tags } = await supabase
      .from("tags")
      .select("*")
      .in("id", tagIds)
      .order("display_order");

    return tags ?? [];
  }
);

export const getAllTags = cache(async (): Promise<Tag[]> => {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return [];

  const { data } = await supabase
    .from("tags")
    .select("*")
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .order("display_order");

  return data ?? [];
});

// ── Tag Group Mutations ───────────────────────────────────

export async function createTagGroup(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = tagGroupSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color") || null,
  });

  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { data, error } = await supabase
    .from("tag_groups")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      color: parsed.data.color ?? null,
      is_system: false,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidateTag("tags", "zeta");
  revalidateTag("zeta", "zeta");
  return { success: true, data: { id: data.id } };
}

export async function updateTagGroup(
  id: string,
  formData: FormData
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = tagGroupSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color") || null,
  });

  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { error } = await supabase
    .from("tag_groups")
    .update({ name: parsed.data.name, color: parsed.data.color ?? null })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidateTag("tags", "zeta");
  return { success: true, data: null };
}

export async function deleteTagGroup(id: string): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("tag_groups")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("is_system", false);

  if (error) return { success: false, error: error.message };

  revalidateTag("tags", "zeta");
  return { success: true, data: null };
}

// ── Tag Mutations ─────────────────────────────────────────

export async function createTag(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = tagSchema.safeParse({
    name: formData.get("name"),
    group_id: formData.get("group_id") || null,
  });

  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const slug = generateSlug(parsed.data.name);

  const { data, error } = await supabase
    .from("tags")
    .insert({
      user_id: user.id,
      group_id: parsed.data.group_id ?? null,
      name: parsed.data.name,
      slug,
      is_system: false,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Ya existe una etiqueta con ese nombre" };
    }
    return { success: false, error: error.message };
  }

  revalidateTag("tags", "zeta");
  return { success: true, data: { id: data.id } };
}

export async function deleteTag(id: string): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("tags")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("is_system", false);

  if (error) return { success: false, error: error.message };

  revalidateTag("tags", "zeta");
  return { success: true, data: null };
}

// ── Entity Tag Mutations ──────────────────────────────────

export async function addTagToEntity(
  tagId: string,
  entityType: TaggableEntity,
  entityId: string
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const tableName = `${entityType}_tags` as const;
  const idColumn = `${entityType}_id` as const;

  const { error } = await supabase
    .from(tableName)
    .insert({ [idColumn]: entityId, tag_id: tagId } as never);

  if (error) {
    if (error.code === "23505") return { success: true, data: null };
    return { success: false, error: error.message };
  }

  revalidateTag("tags", "zeta");
  if (entityType === "transaction") revalidateTag("zeta", "zeta");
  return { success: true, data: null };
}

export async function removeTagFromEntity(
  tagId: string,
  entityType: TaggableEntity,
  entityId: string
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const tableName = `${entityType}_tags` as const;
  const idColumn = `${entityType}_id` as const;

  const { error } = await supabase
    .from(tableName)
    .delete()
    .eq(idColumn, entityId)
    .eq("tag_id", tagId);

  if (error) return { success: false, error: error.message };

  revalidateTag("tags", "zeta");
  if (entityType === "transaction") revalidateTag("zeta", "zeta");
  return { success: true, data: null };
}

export async function bulkTagTransactions(
  tagId: string,
  transactionIds: string[]
): Promise<ActionResult<{ tagged: number }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const rows = transactionIds.map((id) => ({ transaction_id: id, tag_id: tagId }));

  const { error } = await supabase
    .from("transaction_tags")
    .upsert(rows, { onConflict: "transaction_id,tag_id", ignoreDuplicates: true });

  if (error) return { success: false, error: error.message };

  revalidateTag("tags", "zeta");
  revalidateTag("zeta", "zeta");
  return { success: true, data: { tagged: transactionIds.length } };
}
