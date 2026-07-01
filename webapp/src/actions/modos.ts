"use server";

import { cacheTag, cacheLife, updateTag as expireTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { modoSchema, type ModoInput } from "@/lib/validators/modo";
import { dedupeTransactionIds } from "@/lib/utils/tag-ids";
import {
  summarizeModo,
  filterSharedGroupsByOrigin,
  type ModoTxRow,
  type ModoSummary,
} from "@/lib/utils/modo-summary";
import { getSharedPaymentGroups } from "@/actions/shared-payments";
import type { ActionResult } from "@/types/actions";
import type { Modo, SharedPaymentGroup } from "@/types/domain";

const MODO_TX_SELECT =
  "id, amount, direction, transaction_date, category:categories!transactions_category_id_fkey(id, name, name_es, color)";

// ── Membership (single source of truth) ──────────────────
export async function getModoTransactionIds(
  modo: Pick<Modo, "date_from" | "date_to" | "tag_ids">,
  userId: string,
  accessToken: string,
): Promise<string[]> {
  if (!modo.tag_ids || modo.tag_ids.length === 0) return [];
  const supabase = createCachedClient(accessToken);

  const { data: tagged } = await supabase
    .from("transaction_tags")
    .select("transaction_id")
    .eq("user_id", userId)
    .in("tag_id", modo.tag_ids);
  const candidateIds = dedupeTransactionIds(tagged ?? []);
  if (candidateIds.length === 0) return [];

  const { data: rows } = await supabase
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .in("id", candidateIds)
    .gte("transaction_date", modo.date_from)
    .lte("transaction_date", modo.date_to);
  return (rows ?? []).map((r) => r.id);
}

// ── Reads ────────────────────────────────────────────────
async function listModosCached(userId: string, accessToken: string): Promise<Modo[]> {
  "use cache";
  cacheTag("modos");
  cacheLife("zeta");
  const supabase = createCachedClient(accessToken);
  const { data, error } = await supabase
    .from("modos")
    .select("*")
    .eq("user_id", userId)
    .order("date_from", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listModos(): Promise<ActionResult<Modo[]>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  try {
    return { success: true, data: await listModosCached(user.id, accessToken) };
  } catch {
    return { success: false, error: "Error al cargar los modos" };
  }
}

export async function getModo(id: string): Promise<ActionResult<Modo>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  const { data, error } = await supabase
    .from("modos").select("*").eq("id", id).eq("user_id", user.id).single();
  if (error || !data) return { success: false, error: "Modo no encontrado" };
  return { success: true, data };
}

export async function getModoSummary(id: string): Promise<
  ActionResult<{ modo: Modo; summary: ModoSummary; sharedGroups: SharedPaymentGroup[]; transactions: ModoTxRow[] }>
> {
  const { user, accessToken, supabase } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };

  const { data: modo, error } = await supabase
    .from("modos").select("*").eq("id", id).eq("user_id", user.id).single();
  if (error || !modo) return { success: false, error: "Modo no encontrado" };

  const txIds = await getModoTransactionIds(modo, user.id, accessToken);
  let transactions: ModoTxRow[] = [];
  if (txIds.length > 0) {
    const { data } = await supabase
      .from("transactions")
      .select(MODO_TX_SELECT)
      .eq("user_id", user.id)
      .in("id", txIds)
      .order("transaction_date", { ascending: false });
    transactions = (data ?? []) as unknown as ModoTxRow[];
  }

  const summary = summarizeModo(transactions);
  const groupsResult = await getSharedPaymentGroups();
  const sharedGroups = groupsResult.success
    ? filterSharedGroupsByOrigin(groupsResult.data, txIds)
    : [];

  return { success: true, data: { modo, summary, sharedGroups, transactions } };
}

// ── Mutations ────────────────────────────────────────────
type ParsedForm =
  | { success: true; data: ModoInput }
  | { success: false; error: string };

function parseModoForm(formData: FormData): ParsedForm {
  let tagIds: unknown;
  try {
    tagIds = JSON.parse((formData.get("tag_ids") as string) || "[]");
  } catch {
    return { success: false, error: "Etiquetas inválidas" };
  }
  const parsed = modoSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color") || null,
    emoji: formData.get("emoji") || null,
    date_from: formData.get("date_from"),
    date_to: formData.get("date_to"),
    tag_ids: tagIds,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  return { success: true, data: parsed.data };
}

export async function createModo(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  const parsed = parseModoForm(formData);
  if (!parsed.success) return { success: false, error: parsed.error };

  const { data, error } = await supabase
    .from("modos")
    .insert({ ...parsed.data, user_id: user.id })
    .select("id").single();
  if (error || !data) return { success: false, error: error?.message ?? "Error al crear el modo" };

  expireTag("modos");
  return { success: true, data: { id: data.id } };
}

export async function updateModo(id: string, formData: FormData): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  const parsed = parseModoForm(formData);
  if (!parsed.success) return { success: false, error: parsed.error };

  const { error } = await supabase
    .from("modos").update(parsed.data).eq("id", id).eq("user_id", user.id);
  if (error) return { success: false, error: error.message };

  expireTag("modos");
  return { success: true, data: null };
}

export async function deleteModo(id: string): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  const { error } = await supabase
    .from("modos").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { success: false, error: error.message };

  expireTag("modos");
  return { success: true, data: null };
}
