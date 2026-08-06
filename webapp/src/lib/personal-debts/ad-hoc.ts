import "server-only";

/**
 * Ad-hoc split participants.
 *
 * `personal_debts.destinatario_id` is NOT NULL and points at
 * `destinatarios_enc`, which is what keeps the counterparty's identity
 * encrypted while `personal_debts` itself stays a plain table. So "split this
 * bill among 6 people I don't want as contacts" cannot be modeled by relaxing
 * the FK — a free-text name column on `personal_debts` would store the name in
 * PLAINTEXT and break that guarantee.
 *
 * Instead a typed name is materialized into a real destinatario flagged
 * `is_ad_hoc = true`: encrypted like any other, but hidden from every picker
 * and from the destinatarios page (see `getDestinatariosCached`). The user gets
 * the split without gaining six contacts; `promoteAdHocDestinatario` turns one
 * into a real contact if it turns out to matter.
 *
 * Lives in a plain server module (NOT "use server") so it never becomes a
 * client-invocable action surface — same rationale as `recompute.ts`.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

/** Participant as it arrives from the validator: a contact XOR a typed name. */
export interface RawSplitParticipant {
  destinatario_id?: string;
  name?: string;
  value?: number;
}

/** Participant once every name has a destinatario behind it. */
export interface ResolvedSplitParticipant {
  destinatario_id: string;
  value?: number;
}

export type ResolveResult =
  | { ok: true; participants: ResolvedSplitParticipant[]; createdIds: string[] }
  | { ok: false; error: string };

/** Same normalization the validator applies, re-applied defensively. */
function normalize(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function matchKey(name: string): string {
  return normalize(name).toLocaleLowerCase("es");
}

/**
 * Turn `{ name }` participants into `{ destinatario_id }` ones, creating hidden
 * ad-hoc destinatarios for names that don't already exist.
 *
 * Reuse rules, in order:
 *   1. An existing REAL contact with that name wins — typing "Madre" when Madre
 *      is already a contact links the debt to her instead of forking a ghost.
 *   2. Otherwise an existing ad-hoc with that name is reused, so splitting the
 *      same lunch crew every month doesn't pile up duplicates.
 *   3. Otherwise one ad-hoc destinatario is created.
 *
 * Duplicate names within a single request collapse onto ONE destinatario; the
 * debts themselves stay separate rows, which is the correct reading of someone
 * typing the same person twice.
 *
 * `createdIds` is returned so the caller can compensate (delete them) if the
 * mutation it is part of fails afterwards.
 */
export async function resolveSplitParticipants(
  supabase: Client,
  userId: string,
  participants: RawSplitParticipant[],
): Promise<ResolveResult> {
  const typedNames = participants
    .map((p) => p.name)
    .filter((n): n is string => !!n)
    .map(normalize);

  if (typedNames.length === 0) {
    return {
      ok: true,
      createdIds: [],
      participants: participants.map((p) => ({
        destinatario_id: p.destinatario_id!,
        value: p.value,
      })),
    };
  }

  // Existing people to reuse. Only kind='person' — a merchant named "Juan"
  // must not absorb a personal debt.
  const { data: existing, error: existingErr } = await supabase
    .from("destinatarios")
    .select("id, name, is_ad_hoc")
    .eq("user_id", userId)
    .eq("kind", "person");
  if (existingErr) {
    return { ok: false, error: "Error al buscar las personas existentes" };
  }

  const byName = new Map<string, { id: string; isAdHoc: boolean }>();
  for (const d of (existing ?? []) as {
    id: string;
    name: string | null;
    is_ad_hoc: boolean | null;
  }[]) {
    if (!d.name) continue;
    const key = matchKey(d.name);
    const prev = byName.get(key);
    // Rule 1: a real contact beats an ad-hoc one with the same name.
    if (!prev || (prev.isAdHoc && !d.is_ad_hoc)) {
      byName.set(key, { id: d.id, isAdHoc: !!d.is_ad_hoc });
    }
  }

  const toCreate = [...new Set(typedNames.map(matchKey))].filter((k) => !byName.has(k));
  const createdIds: string[] = [];

  if (toCreate.length > 0) {
    // Insert with the ORIGINAL casing the user typed, keyed by the match key.
    const originalByKey = new Map<string, string>();
    for (const n of typedNames) {
      if (!originalByKey.has(matchKey(n))) originalByKey.set(matchKey(n), n);
    }
    const rows = toCreate.map((key) => ({
      id: crypto.randomUUID(),
      user_id: userId,
      name: originalByKey.get(key)!,
      kind: "person" as const,
      is_ad_hoc: true,
      is_active: true,
    }));
    const { error: insErr } = await supabase.from("destinatarios").insert(rows);
    if (insErr) {
      return { ok: false, error: "Error al registrar las personas del reparto" };
    }
    for (let i = 0; i < rows.length; i++) {
      byName.set(toCreate[i], { id: rows[i].id, isAdHoc: true });
      createdIds.push(rows[i].id);
    }
  }

  const resolved: ResolvedSplitParticipant[] = [];
  for (const p of participants) {
    if (p.destinatario_id) {
      resolved.push({ destinatario_id: p.destinatario_id, value: p.value });
      continue;
    }
    const hit = byName.get(matchKey(p.name!));
    if (!hit) {
      // Unreachable unless the insert silently dropped a row; fail loudly
      // rather than persisting a debt against the wrong person.
      return { ok: false, error: "No se pudo resolver una de las personas del reparto" };
    }
    resolved.push({ destinatario_id: hit.id, value: p.value });
  }

  return { ok: true, participants: resolved, createdIds };
}

/**
 * Best-effort removal of ad-hoc destinatarios that no longer back anything.
 *
 * Called after a split is deleted/undone. Only touches `is_ad_hoc` rows — a real
 * contact is never garbage-collected, even if it ends up with zero debts. Never
 * throws: the caller has already committed its mutation, and a leftover hidden
 * row is harmless compared to reporting a false failure.
 */
export async function cleanupAdHocDestinatarios(
  supabase: Client,
  userId: string,
  candidateIds: string[],
): Promise<void> {
  const ids = [...new Set(candidateIds)].filter(Boolean);
  if (ids.length === 0) return;

  try {
    const { data: adHoc, error } = await supabase
      .from("destinatarios")
      .select("id")
      .eq("user_id", userId)
      .eq("is_ad_hoc", true)
      .in("id", ids);
    if (error || !adHoc?.length) return;

    const adHocIds = (adHoc as { id: string }[]).map((d) => d.id);
    const [debtsRes, txRes] = await Promise.all([
      supabase
        .from("personal_debts")
        .select("destinatario_id")
        .eq("user_id", userId)
        .in("destinatario_id", adHocIds),
      supabase
        .from("transactions")
        .select("destinatario_id")
        .eq("user_id", userId)
        .in("destinatario_id", adHocIds),
    ]);
    // A failed reference check must NOT be read as "unreferenced" — that would
    // hit the ON DELETE RESTRICT FK at best, and orphan live debts at worst.
    if (debtsRes.error || txRes.error) return;

    const used = new Set<string>();
    for (const r of (debtsRes.data ?? []) as { destinatario_id: string | null }[]) {
      if (r.destinatario_id) used.add(r.destinatario_id);
    }
    for (const r of (txRes.data ?? []) as { destinatario_id: string | null }[]) {
      if (r.destinatario_id) used.add(r.destinatario_id);
    }

    const orphans = adHocIds.filter((id) => !used.has(id));
    if (orphans.length === 0) return;
    await supabase.from("destinatarios").delete().eq("user_id", userId).in("id", orphans);
  } catch (err) {
    console.error("cleanupAdHocDestinatarios failed (non-fatal):", err);
  }
}
