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
import { getSharedPaymentGroups, splitExistingTransaction } from "@/actions/shared-payments";
import { revalidateFinancialViews } from "@/lib/cache/revalidation";
import { ensureModoTag } from "@/lib/modos/ensure-modo-tag";
import type { ActionResult } from "@/types/actions";
import type { ActiveModo, Modo, ModoParticipant, SharedPaymentGroup } from "@/types/domain";

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
  ActionResult<{ modo: Modo; summary: ModoSummary; sharedGroups: SharedPaymentGroup[]; transactions: ModoTxRow[]; participants: ModoParticipant[] }>
> {
  const { user, accessToken, supabase } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };

  // getSharedPaymentGroups depends only on the user — kick it off in parallel
  // with the modo fetch instead of waiting behind the tx waterfall.
  const [{ data: modo, error }, groupsResult, { data: participants }] = await Promise.all([
    supabase.from("modos").select("*").eq("id", id).eq("user_id", user.id).single(),
    getSharedPaymentGroups(),
    supabase.from("modo_participants").select("*").eq("modo_id", id).eq("user_id", user.id).order("position"),
  ]);
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
  const sharedGroups = groupsResult.success
    ? filterSharedGroupsByOrigin(groupsResult.data, txIds)
    : [];

  return { success: true, data: { modo, summary, sharedGroups, transactions, participants: participants ?? [] } };
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
  let participants: unknown;
  try {
    participants = JSON.parse((formData.get("participants") as string) || "[]");
  } catch {
    return { success: false, error: "Personas inválidas" };
  }
  const parsed = modoSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color") || null,
    emoji: formData.get("emoji") || null,
    date_from: formData.get("date_from"),
    date_to: formData.get("date_to"),
    tag_ids: tagIds,
    auto_tag_id: formData.get("auto_tag_id") || null,
    create_tag: formData.get("create_tag") !== "false",
    is_active: formData.get("is_active") === "true",
    is_shared: formData.get("is_shared") === "true",
    split_method: formData.get("split_method") || "equal",
    user_included: formData.get("user_included") !== "false",
    participants,
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  return { success: true, data: parsed.data };
}

export async function createModo(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  const parsed = parseModoForm(formData);
  if (!parsed.success) return { success: false, error: parsed.error };

  // Every non-column field is peeled off here: the rest is spread straight
  // into the insert and PostgREST rejects unknown columns with a 400.
  const { participants, create_tag, is_active, ...modoRow } = parsed.data;

  // The trip's own tag: what the active trip attaches to manual captures. An
  // existing tag chosen in the wizard wins; otherwise one named after the trip
  // is found-or-created (reusing a same-slug tag such as #Argentina).
  let autoTagId = modoRow.auto_tag_id ?? null;
  let tagCreated = false;
  if (!autoTagId && (create_tag || modoRow.tag_ids.length === 0)) {
    const tag = await ensureModoTag(supabase, user.id, { name: modoRow.name, color: modoRow.color });
    if (!tag.ok) return { success: false, error: tag.error };
    autoTagId = tag.tagId;
    tagCreated = tag.created;
  }
  const tagIds = autoTagId && !modoRow.tag_ids.includes(autoTagId)
    ? [autoTagId, ...modoRow.tag_ids]
    : modoRow.tag_ids;

  const { data, error } = await supabase
    .from("modos")
    .insert({ ...modoRow, tag_ids: tagIds, auto_tag_id: autoTagId, user_id: user.id })
    .select("id").single();
  if (error || !data) return { success: false, error: error?.message ?? "Error al crear el viaje" };

  if (modoRow.is_shared && participants.length > 0) {
    const { error: partErr } = await supabase.from("modo_participants").insert(
      participants.map((p, i) => ({
        modo_id: data.id,
        user_id: user.id,
        destinatario_id: p.destinatario_id,
        share_value: p.value ?? null,
        position: i,
      })),
    );
    if (partErr) return { success: false, error: "Error al guardar las personas del viaje" };
  }

  if (is_active) {
    const act = await activateModoRow(supabase, user.id, data.id);
    if (!act.ok) return { success: false, error: act.error };
  }

  expireTag("modos");
  if (tagCreated) expireTag("tags");
  return { success: true, data: { id: data.id } };
}

export async function updateModo(id: string, formData: FormData): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  const parsed = parseModoForm(formData);
  if (!parsed.success) return { success: false, error: parsed.error };

  // `is_active` is deliberately NOT written here — an edit must never switch
  // the active trip off; that lives in setActiveModo. `create_tag` is a wizard
  // hint with no column behind it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { participants, create_tag: _createTag, is_active: _isActive, ...modoRow } = parsed.data;
  const tagIds = modoRow.auto_tag_id && !modoRow.tag_ids.includes(modoRow.auto_tag_id)
    ? [modoRow.auto_tag_id, ...modoRow.tag_ids]
    : modoRow.tag_ids;
  const { error } = await supabase
    .from("modos").update({ ...modoRow, tag_ids: tagIds }).eq("id", id).eq("user_id", user.id);
  if (error) return { success: false, error: error.message };

  // Reemplazar participantes (N ≈ 1–3; delete-all + re-insert en vez de diff fino).
  const { error: delErr } = await supabase
    .from("modo_participants").delete().eq("modo_id", id).eq("user_id", user.id);
  if (delErr) return { success: false, error: "Error al actualizar las personas del modo" };
  if (modoRow.is_shared && participants.length > 0) {
    const { error: partErr } = await supabase.from("modo_participants").insert(
      participants.map((p, i) => ({
        modo_id: id,
        user_id: user.id,
        destinatario_id: p.destinatario_id,
        share_value: p.value ?? null,
        position: i,
      })),
    );
    if (partErr) return { success: false, error: "Error al guardar las personas del viaje" };
  }

  expireTag("modos");
  return { success: true, data: null };
}

// ── Viaje activo ─────────────────────────────────────────
/**
 * Two statements, in this order: clear the current active trip, then set the
 * new one. PostgREST gives no transaction, so a lost race between two tabs
 * ends either with zero active trips (benign) or a 23505 on the partial unique
 * index `modos_one_active_per_user`, which is surfaced as a retryable message.
 */
async function activateModoRow(
  supabase: Awaited<ReturnType<typeof getAuthenticatedClient>>["supabase"],
  userId: string,
  modoId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error: clearErr } = await supabase
    .from("modos")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("is_active", true)
    .neq("id", modoId);
  if (clearErr) return { ok: false, error: "No se pudo desactivar el viaje anterior" };
  const { error } = await supabase
    .from("modos")
    .update({ is_active: true })
    .eq("id", modoId)
    .eq("user_id", userId);
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya hay otro viaje activo, inténtalo de nuevo" };
    }
    return { ok: false, error: "No se pudo activar el viaje" };
  }
  return { ok: true };
}

/** Marks `id` as the one active trip (or clears it with `null`). */
export async function setActiveModo(id: string | null): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  if (id === null) {
    const { error } = await supabase
      .from("modos")
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("is_active", true);
    if (error) return { success: false, error: "No se pudo terminar el viaje" };
  } else {
    const res = await activateModoRow(supabase, user.id, id);
    if (!res.ok) return { success: false, error: res.error };
  }
  expireTag("modos");
  return { success: true, data: null };
}

const ACTIVE_MODO_SELECT = "id, name, emoji, color, auto_tag_id, date_from, date_to";

/**
 * Tiny, `modos`-tagged only: nothing here derives from transactions, so a
 * capture never expires it and the banner/form preselection stay cheap.
 */
async function getActiveModoCached(userId: string, accessToken: string): Promise<ActiveModo | null> {
  "use cache";
  cacheTag("modos");
  cacheLife("zeta");
  const supabase = createCachedClient(accessToken);
  const { data } = await supabase
    .from("modos")
    .select(ACTIVE_MODO_SELECT)
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return (data as ActiveModo | null) ?? null;
}

export async function getActiveModo(): Promise<ActiveModo | null> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return null;
  try {
    return await getActiveModoCached(user.id, accessToken);
  } catch {
    return null;
  }
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

// ── Compartir (pool single-user) ─────────────────────────
type ShareSkipReason = "already_shared" | "inflow" | "linked_to_person";

export async function shareModoTransactions(
  modoId: string,
  txIds?: string[],
): Promise<
  ActionResult<{ shared: number; skipped: { id: string; reason: ShareSkipReason }[]; failed: string[] }>
> {
  const { supabase, user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };

  const { data: modo, error: modoErr } = await supabase
    .from("modos").select("*").eq("id", modoId).eq("user_id", user.id).single();
  if (modoErr || !modo) return { success: false, error: "Modo no encontrado" };
  if (!modo.is_shared) return { success: false, error: "Este modo no es compartido" };

  const { data: parts } = await supabase
    .from("modo_participants").select("destinatario_id, share_value")
    .eq("modo_id", modoId).eq("user_id", user.id);
  if (!parts || parts.length === 0) {
    return { success: false, error: "El modo no tiene personas para compartir" };
  }

  // Membresía del modo = fuente de verdad. Los txIds del cliente se intersectan
  // con ella para no repartir pagos fuera del modo (evita fuga de alcance).
  const membership = await getModoTransactionIds(modo, user.id, accessToken);
  const memberSet = new Set(membership);
  const candidateIds = txIds && txIds.length
    ? txIds.filter((id) => memberSet.has(id))
    : membership;
  if (candidateIds.length === 0) return { success: true, data: { shared: 0, skipped: [], failed: [] } };

  const { data: txs } = await supabase
    .from("transactions")
    .select("id, amount, currency_code, direction, transaction_date, split_group_id, personal_debt_id")
    .eq("user_id", user.id).in("id", candidateIds);

  const skipped: { id: string; reason: ShareSkipReason }[] = [];
  const failed: string[] = [];
  let shared = 0;

  // ponytail: reparto secuencial; un modo tiene decenas de pagos, no miles.
  // Paralelizar con Promise.all acotado si un modo escala a cientos.
  for (const tx of txs ?? []) {
    if (tx.direction !== "OUTFLOW") { skipped.push({ id: tx.id, reason: "inflow" }); continue; }
    if (tx.split_group_id) { skipped.push({ id: tx.id, reason: "already_shared" }); continue; }
    if (tx.personal_debt_id) { skipped.push({ id: tx.id, reason: "linked_to_person" }); continue; }
    if (tx.amount == null || tx.currency_code == null) { failed.push(tx.id); continue; }
    const res = await splitExistingTransaction(
      supabase, user.id,
      { id: tx.id, amount: Number(tx.amount), currency_code: tx.currency_code },
      {
        method: modo.split_method as "equal" | "percent",
        userIncluded: modo.user_included,
        participants: parts.map((p) => ({ destinatario_id: p.destinatario_id, value: p.share_value ?? undefined })),
        opened_on: tx.transaction_date,
        description: modo.name,
      },
    );
    if (res.ok) shared += 1; else failed.push(tx.id);
  }

  revalidateFinancialViews();
  expireTag("personal-debts");
  expireTag("modos");
  return { success: true, data: { shared, skipped, failed } };
}

export async function unshareModoTransactions(
  modoId: string,
  txIds?: string[],
): Promise<ActionResult<{ unshared: number }>> {
  const { supabase, user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };

  const { data: modo, error: modoErr } = await supabase
    .from("modos").select("*").eq("id", modoId).eq("user_id", user.id).single();
  if (modoErr || !modo) return { success: false, error: "Modo no encontrado" };

  // Intersectar con la membresía del modo (misma razón que en compartir).
  const membership = await getModoTransactionIds(modo, user.id, accessToken);
  const memberSet = new Set(membership);
  const scope = txIds && txIds.length
    ? txIds.filter((id) => memberSet.has(id))
    : membership;
  if (scope.length === 0) return { success: true, data: { unshared: 0 } };

  const { data: txs } = await supabase
    .from("transactions").select("id, split_group_id")
    .eq("user_id", user.id).in("id", scope).not("split_group_id", "is", null);
  const groupIds = [
    ...new Set((txs ?? []).map((t) => t.split_group_id).filter((x): x is string => !!x)),
  ];
  if (groupIds.length === 0) return { success: true, data: { unshared: 0 } };

  // Mismo efecto que deleteSharedPayment, batcheado por los grupos del modo.
  // ponytail: no borra los abonos (pd_role='repayment', sin split_group_id) —
  // dinero real recibido; el ON DELETE SET NULL los deja como INFLOW.
  const { error: debtErr } = await supabase
    .from("personal_debts").delete().eq("user_id", user.id).in("split_group_id", groupIds);
  if (debtErr) return { success: false, error: "Error al quitar los pagos compartidos" };
  const { error: untagErr } = await supabase.from("transactions")
    .update({ split_group_id: null, split_repaid_amount: null })
    .eq("user_id", user.id).in("split_group_id", groupIds);
  if (untagErr) return { success: false, error: "Error al quitar los pagos compartidos" };

  revalidateFinancialViews();
  expireTag("personal-debts");
  expireTag("modos");
  return { success: true, data: { unshared: groupIds.length } };
}
