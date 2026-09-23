"use server";

import { cacheTag, cacheLife, updateTag as expireTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { sharedGroupsHaveSplitRepayments, SPLIT_REPAYMENT_BLOCK_MESSAGE } from "@/lib/personal-debts/recompute";
import { createCachedClient } from "@/lib/supabase/cached";
import { modoSchema, type ModoInput } from "@/lib/validators/modo";
import { dedupeTransactionIds } from "@/lib/utils/tag-ids";
import { getModoTransactionIds } from "@/lib/modos/membership";
import {
  summarizeModo,
  filterSharedGroupsByOrigin,
  collectSplitGroupIds,
  assignTransactionsToModos,
  isModoSpend,
  type ModoTxRow,
  type ModoSummary,
} from "@/lib/utils/modo-summary";
import { getSharedPaymentGroups, splitExistingTransaction } from "@/actions/shared-payments";
import { getPreferredCurrency } from "@/actions/profile";
import { revalidateFinancialViews } from "@/lib/cache/revalidation";
import { ensureModoTag } from "@/lib/modos/ensure-modo-tag";
import { attachTagsToTransactions } from "@/lib/tags/attach-transaction-tags";
import { UUID_RE } from "@/lib/validators/shared";
import {
  classifyModoCandidate,
  compareModoCandidates,
  COUNTED_FLOW_CLASSES,
  type ModoCandidate,
} from "@zeta/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ActionResult } from "@/types/actions";
import type { ActiveModo, Modo, ModoParticipant, ModoWithParticipants, SharedPaymentGroup } from "@/types/domain";

// Everything the detail list shows per row: merchant/description for the
// title, account + destinatario for the meta line, split state for the
// "Repartido" chip, tags to show the ones that are not the trip's own.
const MODO_TX_SELECT =
  "id, amount, direction, transaction_date, transaction_time, currency_code, merchant_name, clean_description, raw_description, notes, " +
  "is_excluded, transfer_group_id, split_group_id, split_repaid_amount, personal_debt_id, capture_method, " +
  "installment_current, installment_total, " +
  "category:categories!transactions_category_id_fkey(id, name, name_es, color), " +
  "account:accounts!transactions_account_id_fkey(id, name, color), " +
  "destinatario:destinatarios!transactions_destinatario_id_fkey(id, name), " +
  "transaction_tags!transaction_tags_transaction_id_fkey(tag:tags(id, name, color))";

// Lean rows for list totals: only what summarizeModo / isModoSpend need.
const MODO_TOTALS_TX_SELECT =
  "id, amount, direction, transaction_date, currency_code, is_excluded, transfer_group_id, personal_debt_id, split_group_id, " +
  "category:categories!transactions_category_id_fkey(id, name, name_es, color)";

// Candidate rows for "¿fue del viaje?": the classification inputs plus what
// the tray shows. Positive allow-list on flow_class_effective (never NOT IN).
const MODO_CANDIDATE_SELECT =
  "id, amount, direction, transaction_date, transaction_time, currency_code, capture_method, flow_class_effective, " +
  "merchant_name, clean_description, raw_description, notes, location_id, is_excluded, is_recurring, is_subscription, " +
  "recurrence_group_id, installment_group_id, transfer_group_id, personal_debt_id, " +
  "category:categories!transactions_category_id_fkey(id, name, name_es, color), " +
  "account:accounts!transactions_account_id_fkey(id, name, color, account_type), " +
  "destinatario:destinatarios!transactions_destinatario_id_fkey(id, name), " +
  "transaction_tags!transaction_tags_transaction_id_fkey(tag:tags(id, name, color)), " +
  "occurrences:recurring_occurrences!recurring_occurrences_transaction_id_fkey(id)";
const MODO_CANDIDATES_LIMIT = 500;

export type ModoCandidateRow = {
  id: string;
  amount: number | null;
  direction: "INFLOW" | "OUTFLOW";
  transaction_date: string;
  transaction_time: string | null;
  currency_code: string | null;
  capture_method: Database["public"]["Enums"]["transaction_capture_method"];
  flow_class_effective: string | null;
  merchant_name: string | null;
  clean_description: string | null;
  raw_description: string | null;
  notes: string | null;
  /** Present when the capture carried a GPS fix — fetched lazily on expand. */
  location_id: string | null;
  category: { id: string; name: string; name_es: string | null; color: string | null } | null;
  account: { id: string; name: string; color: string | null; account_type: string } | null;
  destinatario: { id: string; name: string } | null;
  /** Tags already on the row (the trip's own are never here — those rows are members). */
  tags: Array<{ id: string; name: string; color: string | null }>;
  candidate: ModoCandidate;
};

export type ModoCandidateRange = { date_from: string; date_to: string; tag_ids: string[] };

export type ModoWithTotals = Modo & {
  summary: ModoSummary;
  /** Spend rows already split with someone. */
  sharedCount: number;
  /** Rows in range that look like the trip's but are not tagged yet. */
  pendingReviewCount: number;
};

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

async function listModosWithParticipantsCached(
  userId: string,
  accessToken: string,
): Promise<ModoWithParticipants[]> {
  "use cache";
  cacheTag("modos");
  cacheLife("zeta");
  const supabase = createCachedClient(accessToken);
  const { data: modos, error } = await supabase
    .from("modos")
    .select("*")
    .eq("user_id", userId)
    .order("date_from", { ascending: false });
  if (error) throw error;
  if (!modos || modos.length === 0) return [];
  const { data: participants, error: pErr } = await supabase
    .from("modo_participants")
    .select("*")
    .eq("user_id", userId)
    .in("modo_id", modos.map((m) => m.id))
    .order("position", { ascending: true });
  if (pErr) throw pErr;
  const byModo = new Map<string, ModoParticipant[]>();
  for (const p of participants ?? []) {
    const arr = byModo.get(p.modo_id) ?? [];
    arr.push(p);
    byModo.set(p.modo_id, arr);
  }
  return modos.map((m) => ({ ...m, participants: byModo.get(m.id) ?? [] }));
}

/** Modos + participants in one cached read — the import review's trip picker and "Personas del viaje" preset. */
export async function listModosWithParticipants(): Promise<ActionResult<ModoWithParticipants[]>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  try {
    return { success: true, data: await listModosWithParticipantsCached(user.id, accessToken) };
  } catch {
    return { success: false, error: "Error al cargar los viajes" };
  }
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

async function getModoCached(id: string, userId: string, accessToken: string): Promise<Modo | null> {
  "use cache";
  cacheTag("modos");
  cacheLife("zeta");
  const supabase = createCachedClient(accessToken);
  const { data } = await supabase
    .from("modos").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  return data ?? null;
}

export async function getModo(id: string): Promise<ActionResult<Modo>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  if (!UUID_RE.test(id)) return { success: false, error: "Viaje no encontrado" };
  const data = await getModoCached(id, user.id, accessToken);
  if (!data) return { success: false, error: "Viaje no encontrado" };
  return { success: true, data };
}

async function getModoParticipantsCached(
  modoId: string,
  userId: string,
  accessToken: string,
): Promise<ModoParticipant[]> {
  "use cache";
  cacheTag("modos");
  cacheLife("zeta");
  const supabase = createCachedClient(accessToken);
  const { data } = await supabase
    .from("modo_participants").select("*").eq("modo_id", modoId).eq("user_id", userId).order("position");
  return data ?? [];
}

/** What the edit wizard needs and nothing more (no membership, no candidates). */
export async function getModoWithParticipants(
  id: string,
): Promise<ActionResult<{ modo: Modo; participants: ModoParticipant[] }>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  if (!UUID_RE.test(id)) return { success: false, error: "Viaje no encontrado" };
  const [modo, participants] = await Promise.all([
    getModoCached(id, user.id, accessToken),
    getModoParticipantsCached(id, user.id, accessToken),
  ]);
  if (!modo) return { success: false, error: "Viaje no encontrado" };
  return { success: true, data: { modo, participants } };
}

export type ModoDetail = {
  modo: Modo;
  summary: ModoSummary;
  sharedGroups: SharedPaymentGroup[];
  transactions: ModoTxRow[];
  participants: ModoParticipant[];
  /** Rows in range that could be the trip's but are not tagged yet (tray size). */
  candidatesCount: number;
  /** transaction_id → how it got in ("auto" = active trip, "suggested" = tray, "manual"). */
  reviewSources: Record<string, "auto" | "suggested" | "manual">;
};

async function getModoDetailCached(
  accessToken: string,
  userId: string,
  id: string,
): Promise<Pick<ModoDetail, "modo" | "participants" | "transactions" | "reviewSources"> | null> {
  "use cache";
  cacheTag("modos");
  cacheTag("transactions");
  cacheTag("tags");
  cacheLife("zeta");
  const supabase = createCachedClient(accessToken);

  const [{ data: modo }, { data: participants }, { data: reviews }] = await Promise.all([
    supabase.from("modos").select("*").eq("id", id).eq("user_id", userId).maybeSingle(),
    supabase.from("modo_participants").select("*").eq("modo_id", id).eq("user_id", userId).order("position"),
    supabase.from("modo_tx_reviews").select("transaction_id, source").eq("modo_id", id).eq("user_id", userId).eq("decision", "included"),
  ]);
  if (!modo) return null;

  const txIds = await getModoTransactionIds(modo, userId, accessToken);
  let transactions: ModoTxRow[] = [];
  if (txIds.length > 0) {
    const { data } = await supabase
      .from("transactions")
      .select(MODO_TX_SELECT)
      .eq("user_id", userId)
      .in("id", txIds)
      .order("transaction_date", { ascending: false });
    transactions = (data ?? []) as unknown as ModoTxRow[];
  }
  const reviewSources: ModoDetail["reviewSources"] = {};
  for (const r of reviews ?? []) {
    reviewSources[r.transaction_id] = r.source as "auto" | "suggested" | "manual";
  }
  return { modo, participants: participants ?? [], transactions, reviewSources };
}

export async function getModoSummary(id: string): Promise<ActionResult<ModoDetail>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  if (!UUID_RE.test(id)) return { success: false, error: "Viaje no encontrado" };

  // The shared groups depend only on the user and cannot live inside the
  // cached detail (their wrapper re-auths) — run them in parallel instead.
  // The bare modo row comes first (tiny, cached) so the candidates scan can
  // start alongside the membership chain instead of waiting behind it.
  const [modoRow, groupsResult, homeCurrency] = await Promise.all([
    getModoCached(id, user.id, accessToken),
    getSharedPaymentGroups(),
    getPreferredCurrency(),
  ]);
  if (!modoRow) return { success: false, error: "Viaje no encontrado" };

  const [detail, candidates] = await Promise.all([
    getModoDetailCached(accessToken, user.id, id),
    getModoCandidatesCached(
      accessToken, user.id,
      { date_from: modoRow.date_from, date_to: modoRow.date_to, tag_ids: modoRow.tag_ids },
      id, homeCurrency,
    ),
  ]);
  if (!detail) return { success: false, error: "Viaje no encontrado" };

  const txIds = detail.transactions.map((t) => t.id);
  const summary = summarizeModo(detail.transactions);
  const sharedGroups = groupsResult.success
    ? filterSharedGroupsByOrigin(groupsResult.data, txIds, collectSplitGroupIds(detail.transactions))
    : [];

  return {
    success: true,
    data: {
      ...detail,
      summary,
      sharedGroups,
      candidatesCount: candidates.length,
    },
  };
}

// ── Lista con totales (dos queries para N modos) ─────────
async function listModosWithTotalsCached(
  userId: string,
  accessToken: string,
  homeCurrency: string,
): Promise<ModoWithTotals[]> {
  "use cache";
  cacheTag("modos");
  cacheTag("transactions");
  cacheTag("tags");
  cacheLife("zeta");
  const supabase = createCachedClient(accessToken);

  const { data: modos, error } = await supabase
    .from("modos")
    .select("*")
    .eq("user_id", userId)
    .order("date_from", { ascending: false });
  if (error) throw error;
  if (!modos || modos.length === 0) return [];

  const allTagIds = [...new Set(modos.flatMap((m) => m.tag_ids ?? []))];
  const { data: tagRows } = allTagIds.length
    ? await supabase
        .from("transaction_tags")
        .select("transaction_id, tag_id")
        .eq("user_id", userId)
        .in("tag_id", allTagIds)
    : { data: [] as { transaction_id: string; tag_id: string }[] };
  const candidateIds = dedupeTransactionIds(tagRows ?? []);
  const { data: txs } = candidateIds.length
    ? await supabase
        .from("transactions")
        .select(MODO_TOTALS_TX_SELECT)
        .eq("user_id", userId)
        .in("id", candidateIds)
        // Same rule as getModoTransactionIds: reconciled duplicates are gone.
        .is("reconciled_into_transaction_id", null)
    : { data: [] as unknown[] };
  const byModo = assignTransactionsToModos(modos, tagRows ?? [], (txs ?? []) as unknown as ModoTxRow[]);

  // "Por revisar" per trip: one bounded range scan per modo (a user has a
  // handful of trips, not hundreds), so an old trip's count is never starved
  // by a newer trip eating a shared row cap.
  const [candidatesPerModo, { data: reviewRows }] = await Promise.all([
    Promise.all(modos.map((m) => fetchCandidateRows(supabase, userId, m.date_from, m.date_to))),
    supabase.from("modo_tx_reviews").select("modo_id, transaction_id").eq("user_id", userId),
  ]);
  const reviewedByModo = new Map<string, Set<string>>();
  for (const r of reviewRows ?? []) {
    const set = reviewedByModo.get(r.modo_id) ?? new Set<string>();
    set.add(r.transaction_id);
    reviewedByModo.set(r.modo_id, set);
  }

  return modos.map((modo, i) => {
    const rows = byModo.get(modo.id) ?? [];
    const reviewed = reviewedByModo.get(modo.id) ?? new Set<string>();
    const pending = classifyCandidateRows(candidatesPerModo[i].data ?? [], modo, reviewed, homeCurrency).length;
    return {
      ...modo,
      summary: summarizeModo(rows),
      sharedCount: rows.filter((t) => isModoSpend(t) && !!t.split_group_id).length,
      pendingReviewCount: pending,
    };
  });
}

export async function listModosWithTotals(): Promise<ActionResult<ModoWithTotals[]>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  try {
    const homeCurrency = await getPreferredCurrency();
    return { success: true, data: await listModosWithTotalsCached(user.id, accessToken, homeCurrency) };
  } catch {
    return { success: false, error: "Error al cargar los viajes" };
  }
}

// ── Candidatos ("¿fue del viaje?") ───────────────────────
type RawCandidateRow = Omit<ModoCandidateRow, "candidate" | "tags"> & {
  is_excluded: boolean | null;
  is_recurring: boolean | null;
  is_subscription: boolean | null;
  recurrence_group_id: string | null;
  installment_group_id: string | null;
  transfer_group_id: string | null;
  personal_debt_id: string | null;
  transaction_tags: Array<{ tag: { id: string; name: string; color: string | null } | null }> | null;
  occurrences: Array<{ id: string }> | null;
};

function fetchCandidateRows(
  supabase: SupabaseClient<Database>,
  userId: string,
  dateFrom: string,
  dateTo: string,
) {
  return supabase
    .from("transactions")
    .select(MODO_CANDIDATE_SELECT)
    .eq("user_id", userId)
    .eq("direction", "OUTFLOW")
    .eq("is_excluded", false)
    .is("transfer_group_id", null)
    .is("personal_debt_id", null)
    .is("reconciled_into_transaction_id", null)
    .in("flow_class_effective", COUNTED_FLOW_CLASSES)
    .gte("transaction_date", dateFrom)
    .lte("transaction_date", dateTo)
    .order("transaction_date", { ascending: false })
    .limit(MODO_CANDIDATES_LIMIT) as unknown as PromiseLike<{ data: RawCandidateRow[] | null }>;
}

function classifyCandidateRows(
  rows: RawCandidateRow[],
  range: ModoCandidateRange,
  reviewed: Set<string>,
  homeCurrency: string,
): ModoCandidateRow[] {
  const out: ModoCandidateRow[] = [];
  for (const row of rows) {
    const tags = (row.transaction_tags ?? [])
      .map((t) => t.tag)
      .filter((t): t is NonNullable<typeof t> => !!t);
    const candidate = classifyModoCandidate(
      {
        id: row.id,
        direction: row.direction,
        transaction_date: row.transaction_date,
        capture_method: row.capture_method,
        flow_class: row.flow_class_effective,
        currency_code: row.currency_code,
        is_excluded: row.is_excluded,
        is_recurring: row.is_recurring,
        is_subscription: row.is_subscription,
        recurrence_group_id: row.recurrence_group_id,
        installment_group_id: row.installment_group_id,
        transfer_group_id: row.transfer_group_id,
        personal_debt_id: row.personal_debt_id,
        linkedToOccurrence: (row.occurrences?.length ?? 0) > 0,
        tag_ids: tags.map((t) => t.id),
        reviewed: reviewed.has(row.id),
      },
      range,
      { homeCurrency },
    );
    // A trip created after the fact must also offer the manual captures of
    // those dates, so both "auto" and "suggest" are tray material here.
    if (candidate.verdict === "skip") continue;
    const { transaction_tags: _t, occurrences: _o, ...rest } = row;
    void _t; void _o;
    out.push({ ...rest, tags, candidate });
  }
  return out.sort((a, b) =>
    compareModoCandidates(
      { candidate: a.candidate, tx: { flow_class: a.flow_class_effective, transaction_date: a.transaction_date } },
      { candidate: b.candidate, tx: { flow_class: b.flow_class_effective, transaction_date: b.transaction_date } },
    ),
  );
}

async function getModoCandidatesCached(
  accessToken: string,
  userId: string,
  range: ModoCandidateRange,
  modoId: string | null,
  homeCurrency: string,
): Promise<ModoCandidateRow[]> {
  "use cache";
  cacheTag("modos");
  cacheTag("transactions");
  cacheTag("tags");
  cacheLife("zeta");
  const supabase = createCachedClient(accessToken);
  const [{ data: rows }, { data: reviews }] = await Promise.all([
    fetchCandidateRows(supabase, userId, range.date_from, range.date_to),
    modoId
      ? supabase.from("modo_tx_reviews").select("transaction_id").eq("modo_id", modoId).eq("user_id", userId)
      : Promise.resolve({ data: [] as { transaction_id: string }[] }),
  ]);
  const reviewed = new Set((reviews ?? []).map((r) => r.transaction_id));
  return classifyCandidateRows(rows ?? [], range, reviewed, homeCurrency);
}

/**
 * Rows inside `range` that look like the trip's but carry none of its tags.
 * With `modoId`, rows the user already decided on are left out. Without it
 * (wizard, before the trip exists) it doubles as the live "N movimientos en
 * estas fechas" preview.
 */
export async function getModoCandidates(
  range: { date_from: string; date_to: string; tag_ids?: string[] },
  modoId?: string,
): Promise<ActionResult<ModoCandidateRow[]>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(range.date_from) || !/^\d{4}-\d{2}-\d{2}$/.test(range.date_to)) {
    return { success: false, error: "Fechas inválidas" };
  }
  if (range.date_from > range.date_to) return { success: true, data: [] };
  if (modoId && !UUID_RE.test(modoId)) return { success: false, error: "Viaje no encontrado" };
  const tagIds = (range.tag_ids ?? []).filter((id) => UUID_RE.test(id));
  try {
    const homeCurrency = await getPreferredCurrency();
    const data = await getModoCandidatesCached(
      accessToken, user.id,
      { date_from: range.date_from, date_to: range.date_to, tag_ids: tagIds },
      modoId ?? null, homeCurrency,
    );
    return { success: true, data };
  } catch {
    return { success: false, error: "Error al buscar movimientos del viaje" };
  }
}

/**
 * Shared by the tray, the wizard's last step and createModo: tag `include`
 * with the trip's tag and remember both decisions so the tray stops asking.
 */
async function applyModoReview(
  supabase: SupabaseClient<Database>,
  userId: string,
  modo: Pick<Modo, "id" | "auto_tag_id" | "tag_ids">,
  decisions: { include: string[]; exclude: string[] },
  source: "suggested" | "manual",
): Promise<{ ok: true; included: number; excluded: number } | { ok: false; error: string }> {
  const include = [...new Set(decisions.include.filter((id) => UUID_RE.test(id)))];
  let exclude = [...new Set(decisions.exclude.filter((id) => UUID_RE.test(id) && !include.includes(id)))];
  // `include` is ownership-checked by attachTagsToTransactions; give the
  // excluded ids the same defense-in-depth before they land in modo_tx_reviews.
  if (exclude.length > 0) {
    const { data: owned } = await supabase
      .from("transactions")
      .select("id")
      .eq("user_id", userId)
      .in("id", exclude);
    const ownedIds = new Set((owned ?? []).map((r) => r.id));
    exclude = exclude.filter((id) => ownedIds.has(id));
  }
  const tagId = modo.auto_tag_id ?? modo.tag_ids[0] ?? null;
  if (include.length > 0 && !tagId) {
    return { ok: false, error: "Este viaje no tiene etiqueta para marcar movimientos" };
  }
  if (include.length > 0) {
    const res = await attachTagsToTransactions(supabase, userId, include, [tagId!]);
    if (res.error) return { ok: false, error: "No se pudieron agregar los movimientos al viaje" };
  }
  const rows = [
    ...include.map((transaction_id) => ({ modo_id: modo.id, user_id: userId, transaction_id, decision: "included", source })),
    ...exclude.map((transaction_id) => ({ modo_id: modo.id, user_id: userId, transaction_id, decision: "excluded", source })),
  ];
  if (rows.length > 0) {
    const { error } = await supabase
      .from("modo_tx_reviews")
      .upsert(rows, { onConflict: "modo_id,transaction_id" });
    if (error) return { ok: false, error: "No se pudo guardar la revisión" };
  }
  return { ok: true, included: include.length, excluded: exclude.length };
}

export async function reviewModoCandidates(
  modoId: string,
  decisions: { include: string[]; exclude: string[] },
): Promise<ActionResult<{ included: number; excluded: number }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  if (!UUID_RE.test(modoId)) return { success: false, error: "Viaje no encontrado" };
  const { data: modo } = await supabase
    .from("modos").select("id, auto_tag_id, tag_ids").eq("id", modoId).eq("user_id", user.id).maybeSingle();
  if (!modo) return { success: false, error: "Viaje no encontrado" };

  const res = await applyModoReview(supabase, user.id, modo, decisions, "suggested");
  if (!res.ok) return { success: false, error: res.error };

  // Tag-only write: no amount, balance or debt moved. Only the caches keyed on
  // transactions/tags/modos need to expire, not the whole financial sweep.
  expireModoTagCaches();
  return { success: true, data: { included: res.included, excluded: res.excluded } };
}

/**
 * "No fue del viaje": drop the trip's tags from the rows and remember the
 * decision so the tray never proposes them again. Split state is untouched —
 * a shared payment stays shared; use unshareModoTransactions for that.
 */
export async function removeFromModo(
  modoId: string,
  txIds: string[],
): Promise<ActionResult<{ removed: number }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  if (!UUID_RE.test(modoId)) return { success: false, error: "Viaje no encontrado" };
  const ids = [...new Set(txIds.filter((id) => UUID_RE.test(id)))];
  if (ids.length === 0) return { success: true, data: { removed: 0 } };
  const { data: modo } = await supabase
    .from("modos").select("id, auto_tag_id, tag_ids").eq("id", modoId).eq("user_id", user.id).maybeSingle();
  if (!modo) return { success: false, error: "Viaje no encontrado" };
  if (modo.tag_ids.length > 0) {
    const { error } = await supabase
      .from("transaction_tags")
      .delete()
      .eq("user_id", user.id)
      .in("transaction_id", ids)
      .in("tag_id", modo.tag_ids);
    if (error) return { success: false, error: "No se pudo quitar el movimiento del viaje" };
  }
  const res = await applyModoReview(supabase, user.id, modo, { include: [], exclude: ids }, "manual");
  if (!res.ok) return { success: false, error: res.error };

  expireModoTagCaches();
  return { success: true, data: { removed: ids.length } };
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
  if (error || !data) {
    console.error("createModo insert failed", error);
    return { success: false, error: "Error al crear el viaje" };
  }

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
    if (partErr) {
      // No orphan trips: undo the insert so the user does not find a half-made
      // trip in the list after an error.
      await supabase.from("modos").delete().eq("id", data.id).eq("user_id", user.id);
      return { success: false, error: "Error al guardar las personas del viaje" };
    }
  }

  if (is_active) {
    const act = await activateModoRow(supabase, user.id, data.id);
    if (!act.ok) {
      await supabase.from("modos").delete().eq("id", data.id).eq("user_id", user.id);
      return { success: false, error: act.error };
    }
  }

  // Wizard step 3: the candidates the user ticked get tagged in the same go.
  let includedAny = false;
  const includeIds = readIdListField(formData, "include_tx_ids");
  const excludeIds = readIdListField(formData, "exclude_tx_ids");
  if (includeIds.length > 0 || excludeIds.length > 0) {
    const review = await applyModoReview(
      supabase, user.id,
      { id: data.id, auto_tag_id: autoTagId, tag_ids: tagIds },
      { include: includeIds, exclude: excludeIds },
      "suggested",
    );
    // The trip exists already; a review failure is not worth failing the create.
    if (!review.ok) console.error("createModo: review failed", review.error);
    else includedAny = review.included > 0;
  }

  if (includedAny) expireModoTagCaches();
  else {
    expireTag("modos");
    if (tagCreated) expireTag("tags");
  }
  return { success: true, data: { id: data.id } };
}

/** Caches a tag attach/detach can change: the modo reads plus transaction lists. */
function expireModoTagCaches() {
  expireTag("transactions");
  expireTag("tags");
  expireTag("modos");
}

/** JSON array of uuids in a FormData field; junk is dropped, never fatal. */
function readIdListField(formData: FormData, key: string): string[] {
  try {
    const raw = JSON.parse((formData.get(key) as string) || "[]");
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string" && UUID_RE.test(x)) : [];
  } catch {
    return [];
  }
}

export async function updateModo(id: string, formData: FormData): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  if (!UUID_RE.test(id)) return { success: false, error: "Viaje no encontrado" };
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
  const { data: updated, error } = await supabase
    .from("modos")
    .update({ ...modoRow, tag_ids: tagIds })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("updateModo failed", error);
    return { success: false, error: "Error al guardar el viaje" };
  }
  if (!updated) return { success: false, error: "Viaje no encontrado" };

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
  // Check-first: a zero-row update is not an error in PostgREST, so without
  // this a foreign or deleted id would silently end the current trip.
  const { data: owned } = await supabase
    .from("modos")
    .select("id")
    .eq("id", modoId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!owned) return { ok: false, error: "Viaje no encontrado" };
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
  if (id !== null && !UUID_RE.test(id)) return { success: false, error: "Viaje no encontrado" };
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
  if (!UUID_RE.test(id)) return { success: false, error: "Viaje no encontrado" };
  const { data: deleted, error } = await supabase
    .from("modos").delete().eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
  if (error) {
    console.error("deleteModo failed", error);
    return { success: false, error: "Error al eliminar el viaje" };
  }
  if (!deleted) return { success: false, error: "Viaje no encontrado" };

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
  if (!UUID_RE.test(modoId)) return { success: false, error: "Viaje no encontrado" };

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
  if (!UUID_RE.test(modoId)) return { success: false, error: "Viaje no encontrado" };

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

  try {
    if (await sharedGroupsHaveSplitRepayments(supabase, user.id, groupIds)) {
      return { success: false, error: SPLIT_REPAYMENT_BLOCK_MESSAGE };
    }
  } catch {
    return { success: false, error: "Error al quitar los pagos compartidos" };
  }

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
