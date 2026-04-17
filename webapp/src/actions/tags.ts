"use server";

import { cache } from "react";
import { cacheTag, cacheLife, updateTag as expireTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { tagGroupSchema, tagSchema, generateSlug } from "@/lib/validators/tags";
import type { ActionResult } from "@/types/actions";
import type { TagGroupWithTags, Tag, TaggableEntity } from "@/types/domain";

import { UNGROUPED_TAG_GROUP_ID } from "@/lib/constants/tags";

// ── Cached inner functions ───────────────────────────────

async function getTagGroupsCached(userId: string, accessToken: string): Promise<TagGroupWithTags[]> {
  "use cache";
  cacheTag("tags");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  const [{ data: groups, error: groupsError }, { data: tags, error: tagsError }] =
    await Promise.all([
      supabase
        .from("tag_groups")
        .select("*")
        .or(`user_id.eq.${userId},user_id.is.null`)
        .order("display_order"),
      supabase
        .from("tags")
        .select("*")
        .or(`user_id.eq.${userId},user_id.is.null`)
        .order("display_order"),
    ]);

  if (groupsError) throw groupsError;
  if (tagsError) throw tagsError;

  const groupIds = new Set(groups.map((g) => g.id));
  const groupsWithTags: TagGroupWithTags[] = groups.map((g) => ({
    ...g,
    tags: tags.filter((t) => t.group_id === g.id),
  }));

  const ungroupedTags = tags.filter((t) => !t.group_id || !groupIds.has(t.group_id));
  if (ungroupedTags.length > 0) {
    groupsWithTags.push({
      id: UNGROUPED_TAG_GROUP_ID,
      user_id: null,
      name: "Sin grupo",
      color: null,
      is_system: false,
      display_order: 9999,
      created_at: new Date().toISOString(),
      tags: ungroupedTags,
    });
  }

  return groupsWithTags;
}

async function getAllTagsCached(userId: string, accessToken: string): Promise<Tag[]> {
  "use cache";
  cacheTag("tags");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order("display_order");

  if (error) throw error;
  return data ?? [];
}

async function getRecentTagsCached(
  userId: string,
  accessToken: string,
  limit: number
): Promise<Array<{ id: string; name: string; color: string | null }>> {
  "use cache";
  cacheTag("tags");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  // Query through transactions (has user_id + transaction_date) for defense-in-depth
  const { data } = await supabase
    .from("transactions")
    .select("transaction_date, transaction_tags!inner(tag_id, tags!inner(id, name, color))")
    .eq("user_id", userId)
    .order("transaction_date", { ascending: false })
    .limit(50);

  if (!data) return [];

  const seen = new Set<string>();
  const result: Array<{ id: string; name: string; color: string | null }> = [];
  for (const row of data) {
    const tagJoins = row.transaction_tags as unknown as Array<{ tags: { id: string; name: string; color: string | null } }>;
    if (!tagJoins) continue;
    for (const tj of tagJoins) {
      const tag = tj.tags;
      if (!tag || seen.has(tag.id)) continue;
      seen.add(tag.id);
      result.push({ id: tag.id, name: tag.name, color: tag.color });
      if (result.length >= limit) return result;
    }
  }
  return result;
}

// ── Public wrappers ──────────────────────────────────────

export const getTagGroups = cache(async (): Promise<ActionResult<TagGroupWithTags[]>> => {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };

  try {
    const data = await getTagGroupsCached(user.id, accessToken);
    return { success: true, data };
  } catch (error) {
    console.error("Error loading tag groups:", error);
    return { success: false, error: "Error al cargar las etiquetas" };
  }
});

async function getTagsForEntityCached(
  userId: string,
  accessToken: string,
  entityType: TaggableEntity,
  entityId: string,
): Promise<Tag[]> {
  "use cache";
  cacheTag("tags");
  // Needed so that deleting a recurring template (which expires "recurring")
  // busts any cached tag lookups for that template id — otherwise the cached
  // result lingers until TTL and reports tags for a template that no longer
  // exists. Per Gemini review on PR #179.
  cacheTag("recurring");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  // Ownership check — verify entity belongs to calling user
  if (entityType === "transaction") {
    const { data: tx } = await supabase
      .from("transactions")
      .select("id")
      .eq("id", entityId)
      .eq("user_id", userId)
      .single();
    if (!tx) return [];
  } else if (entityType === "destinatario") {
    const { data: dest } = await supabase
      .from("destinatarios")
      .select("id")
      .eq("id", entityId)
      .eq("user_id", userId)
      .single();
    if (!dest) return [];
  } else if (entityType === "recurring_template") {
    const { data: tpl } = await supabase
      .from("recurring_transaction_templates")
      .select("id")
      .eq("id", entityId)
      .eq("user_id", userId)
      .single();
    if (!tpl) return [];
  }
  // categories can be system-owned — skip ownership check

  let tagIdRows: Array<{ tag_id: string }> | null = null;
  if (entityType === "recurring_template") {
    const { data } = await supabase
      .from("recurring_template_tags")
      .select("tag_id")
      .eq("recurring_template_id", entityId);
    tagIdRows = data;
  } else if (entityType === "transaction") {
    const { data } = await supabase
      .from("transaction_tags")
      .select("tag_id")
      .eq("transaction_id", entityId);
    tagIdRows = data;
  } else if (entityType === "destinatario") {
    const { data } = await supabase
      .from("destinatario_tags")
      .select("tag_id")
      .eq("destinatario_id", entityId);
    tagIdRows = data;
  } else {
    const { data } = await supabase
      .from("category_tags")
      .select("tag_id")
      .eq("category_id", entityId);
    tagIdRows = data;
  }

  const data = tagIdRows;

  if (!data || data.length === 0) return [];

  const tagIds = data.map((r: { tag_id: string }) => r.tag_id);
  const { data: tags } = await supabase
    .from("tags")
    .select("*")
    .in("id", tagIds)
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order("display_order");

  return tags ?? [];
}

export async function getTagsForEntity(
  entityType: TaggableEntity,
  entityId: string,
): Promise<Tag[]> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return [];

  return getTagsForEntityCached(user.id, accessToken, entityType, entityId);
}

export const getAllTags = cache(async (): Promise<Tag[]> => {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return [];

  try {
    return await getAllTagsCached(user.id, accessToken);
  } catch (error) {
    console.error("Error loading tags:", error);
    return [];
  }
});

export async function getRecentTags(
  limit = 5
): Promise<Array<{ id: string; name: string; color: string | null }>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return [];
  return getRecentTagsCached(user.id, accessToken, limit);
}

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

  expireTag("tags");
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

  expireTag("tags");
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

  expireTag("tags");
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

  expireTag("tags");
  return { success: true, data: { id: data.id } };
}

export async function updateTag(
  id: string,
  formData: FormData
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = tagSchema.safeParse({
    name: formData.get("name"),
    group_id: formData.get("group_id") || null,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const slug = generateSlug(parsed.data.name);

  const { error } = await supabase
    .from("tags")
    .update({ name: parsed.data.name, slug })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("is_system", false);

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "Ya existe una etiqueta con ese nombre" };
    }
    return { success: false, error: error.message };
  }

  expireTag("tags");
  return { success: true, data: null };
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

  expireTag("tags");
  return { success: true, data: null };
}

// ── Entity Tag Mutations ──────────────────────────────────

async function verifyEntityOwnership(
  supabase: Awaited<ReturnType<typeof getAuthenticatedClient>>["supabase"],
  entityType: TaggableEntity,
  entityId: string,
  userId: string
): Promise<boolean> {
  if (entityType === "category") return true; // categories can be system-owned
  const table =
    entityType === "transaction"
      ? "transactions"
      : entityType === "destinatario"
        ? "destinatarios"
        : "recurring_transaction_templates";
  const { data } = await supabase
    .from(table)
    .select("id")
    .eq("id", entityId)
    .eq("user_id", userId)
    .single();
  return !!data;
}

export async function addTagToEntity(
  tagId: string,
  entityType: TaggableEntity,
  entityId: string
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  if (!(await verifyEntityOwnership(supabase, entityType, entityId, user.id))) {
    return { success: false, error: "No autorizado" };
  }

  // recurring_template_tags has a denormalized user_id column (fast-path RLS);
  // the other three junction tables do not. Branch for type safety.
  let insertError: { code?: string; message: string } | null = null;
  if (entityType === "recurring_template") {
    const { error } = await supabase
      .from("recurring_template_tags")
      .insert({ recurring_template_id: entityId, tag_id: tagId, user_id: user.id });
    insertError = error;
  } else if (entityType === "transaction") {
    const { error } = await supabase
      .from("transaction_tags")
      .insert({ transaction_id: entityId, tag_id: tagId });
    insertError = error;
  } else if (entityType === "destinatario") {
    const { error } = await supabase
      .from("destinatario_tags")
      .insert({ destinatario_id: entityId, tag_id: tagId });
    insertError = error;
  } else {
    const { error } = await supabase
      .from("category_tags")
      .insert({ category_id: entityId, tag_id: tagId });
    insertError = error;
  }

  if (insertError) {
    if (insertError.code === "23505") return { success: true, data: null };
    return { success: false, error: insertError.message };
  }

  expireTag("tags");
  if (entityType === "transaction") {
    expireTag("categorize");
    expireTag("transactions");
  }
  if (entityType === "destinatario") expireTag("destinatarios");
  if (entityType === "category") expireTag("categories");
  if (entityType === "recurring_template") expireTag("recurring");
  return { success: true, data: null };
}

export async function removeTagFromEntity(
  tagId: string,
  entityType: TaggableEntity,
  entityId: string
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  if (!(await verifyEntityOwnership(supabase, entityType, entityId, user.id))) {
    return { success: false, error: "No autorizado" };
  }

  let deleteError: { message: string } | null = null;
  if (entityType === "recurring_template") {
    const { error } = await supabase
      .from("recurring_template_tags")
      .delete()
      .eq("recurring_template_id", entityId)
      .eq("tag_id", tagId);
    deleteError = error;
  } else if (entityType === "transaction") {
    const { error } = await supabase
      .from("transaction_tags")
      .delete()
      .eq("transaction_id", entityId)
      .eq("tag_id", tagId);
    deleteError = error;
  } else if (entityType === "destinatario") {
    const { error } = await supabase
      .from("destinatario_tags")
      .delete()
      .eq("destinatario_id", entityId)
      .eq("tag_id", tagId);
    deleteError = error;
  } else {
    const { error } = await supabase
      .from("category_tags")
      .delete()
      .eq("category_id", entityId)
      .eq("tag_id", tagId);
    deleteError = error;
  }

  if (deleteError) return { success: false, error: deleteError.message };

  expireTag("tags");
  if (entityType === "transaction") {
    expireTag("categorize");
    expireTag("transactions");
  }
  if (entityType === "destinatario") expireTag("destinatarios");
  if (entityType === "category") expireTag("categories");
  if (entityType === "recurring_template") expireTag("recurring");
  return { success: true, data: null };
}

export async function bulkTagTransactions(
  tagId: string,
  transactionIds: string[]
): Promise<ActionResult<{ tagged: number }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // Defense-in-depth: verify tag belongs to user (or is system tag)
  const { data: tag } = await supabase
    .from("tags")
    .select("id")
    .eq("id", tagId)
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .single();
  if (!tag) return { success: false, error: "Etiqueta no encontrada" };

  // Deduplicate to avoid false count mismatch
  const uniqueIds = [...new Set(transactionIds)];

  // Defense-in-depth: verify all transactions belong to user
  const { count } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("id", uniqueIds);
  if (count !== uniqueIds.length) {
    return { success: false, error: "Transacciones no encontradas" };
  }

  const rows = uniqueIds.map((id) => ({ transaction_id: id, tag_id: tagId }));

  const { error } = await supabase
    .from("transaction_tags")
    .upsert(rows, { onConflict: "transaction_id,tag_id", ignoreDuplicates: true });

  if (error) return { success: false, error: error.message };

  expireTag("tags");
  expireTag("categorize");
  expireTag("transactions");
  return { success: true, data: { tagged: uniqueIds.length } };
}
