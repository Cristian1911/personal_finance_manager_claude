import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { generateSlug } from "@/lib/utils/string";

export const MODO_TAG_GROUP_NAME = "Viajes y eventos";

/**
 * Find-or-create the tag a viaje/evento uses to mark its transactions.
 *
 * The tag lives under a "Viajes y eventos" group (created on first use) and is
 * keyed by slug: `tags` has a unique index on `(coalesce(user_id), slug)`, so a
 * trip named "Argentina" reuses an existing `#Argentina` instead of failing
 * with 23505 — which is exactly what a user who already tagged the trip wants.
 * Colour is only set on creation; an existing tag keeps whatever it had.
 *
 * Caller owns cache invalidation (`updateTag("tags")`).
 */
export async function ensureModoTag(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: { name: string; color?: string | null },
): Promise<{ ok: true; tagId: string; created: boolean } | { ok: false; error: string }> {
  const name = input.name.trim();
  const slug = generateSlug(name);
  if (!slug) return { ok: false, error: "El nombre del viaje no sirve como etiqueta" };

  const { data: existing } = await supabase
    .from("tags")
    .select("id")
    .eq("user_id", userId)
    .eq("slug", slug)
    .maybeSingle();
  if (existing) return { ok: true, tagId: existing.id, created: false };

  // Group: find by name, create if missing (user-scoped, never system).
  let groupId: string | null = null;
  const { data: group } = await supabase
    .from("tag_groups")
    .select("id")
    .eq("user_id", userId)
    .eq("name", MODO_TAG_GROUP_NAME)
    .maybeSingle();
  if (group) {
    groupId = group.id;
  } else {
    const { data: created } = await supabase
      .from("tag_groups")
      .insert({ user_id: userId, name: MODO_TAG_GROUP_NAME, color: null, is_system: false })
      .select("id")
      .single();
    groupId = created?.id ?? null;
  }

  const { data: tag, error } = await supabase
    .from("tags")
    .insert({
      user_id: userId,
      group_id: groupId,
      name,
      slug,
      color: input.color ?? null,
      is_system: false,
    })
    .select("id")
    .single();
  if (error || !tag) {
    // Lost a race with a concurrent create — the slug now exists, reuse it.
    if (error?.code === "23505") {
      const { data: raced } = await supabase
        .from("tags")
        .select("id")
        .eq("user_id", userId)
        .eq("slug", slug)
        .maybeSingle();
      if (raced) return { ok: true, tagId: raced.id, created: false };
    }
    return { ok: false, error: "No se pudo crear la etiqueta del viaje" };
  }
  return { ok: true, tagId: tag.id, created: true };
}
