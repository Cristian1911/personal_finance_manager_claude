import * as Crypto from "expo-crypto";
import type { DestinatarioRule } from "@zeta/shared";
import { getDatabase } from "../db/database";
import { enqueueDelete, enqueueInsert, enqueueUpdate } from "../sync/queue";

export type DestinatarioRow = {
  id: string;
  user_id: string;
  name: string;
  name_hmac: string | null;
  default_category_id: string | null;
  notes: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

export type DestinatarioRuleRow = {
  id: string;
  user_id: string;
  destinatario_id: string;
  pattern: string;
  match_type: string;
  priority: number;
  match_count: number;
  last_matched_at: string | null;
  created_at: string;
};

/** Destinatario with its transaction count */
export type DestinatarioWithCount = DestinatarioRow & {
  transaction_count: number;
  category_name: string | null;
};

export async function getAllDestinatarios(): Promise<DestinatarioWithCount[]> {
  const db = await getDatabase();
  return db.getAllAsync<DestinatarioWithCount>(
    `SELECT
      d.*,
      COALESCE(c.name_es, c.name) AS category_name,
      (SELECT COUNT(*) FROM transactions t WHERE t.destinatario_id = d.id) AS transaction_count
    FROM destinatarios d
    LEFT JOIN categories c ON d.default_category_id = c.id
    WHERE d.is_active = 1
    ORDER BY d.name ASC`
  );
}

export async function getDestinatarioById(
  id: string
): Promise<DestinatarioWithCount | null> {
  const db = await getDatabase();
  return db.getFirstAsync<DestinatarioWithCount>(
    `SELECT
      d.*,
      COALESCE(c.name_es, c.name) AS category_name,
      (SELECT COUNT(*) FROM transactions t WHERE t.destinatario_id = d.id) AS transaction_count
    FROM destinatarios d
    LEFT JOIN categories c ON d.default_category_id = c.id
    WHERE d.id = ?`,
    [id]
  );
}

export async function getRulesForDestinatario(
  destinatarioId: string
): Promise<DestinatarioRuleRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<DestinatarioRuleRow>(
    `SELECT * FROM destinatario_rules
     WHERE destinatario_id = ?
     ORDER BY priority DESC`,
    [destinatarioId]
  );
}

/**
 * Join active destinatarios + rules into the `DestinatarioRule[]` shape that
 * `prepareDestinatarioRules` / `matchDestinatario` (from `@zeta/shared`) accept.
 * Used by the PDF import flow to silently auto-assign destinatarios + their
 * preferred category (parity with webapp `step-review.tsx`).
 */
export async function getDestinatarioRulesForMatching(): Promise<DestinatarioRule[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    destinatario_id: string;
    destinatario_name: string;
    default_category_id: string | null;
    match_type: string;
    pattern: string;
    priority: number;
  }>(
    `SELECT
       d.id AS destinatario_id,
       d.name AS destinatario_name,
       d.default_category_id,
       r.match_type,
       r.pattern,
       r.priority
     FROM destinatario_rules r
     JOIN destinatarios d ON r.destinatario_id = d.id
     WHERE d.is_active = 1
     ORDER BY r.priority DESC`
  );
  return rows.map((r) => ({
    destinatario_id: r.destinatario_id,
    destinatario_name: r.destinatario_name,
    default_category_id: r.default_category_id,
    match_type: r.match_type === "exact" ? "exact" : "contains",
    pattern: r.pattern,
    priority: r.priority,
  }));
}

export type CreateDestinatarioParams = {
  user_id: string;
  name: string;
  default_category_id?: string | null;
  notes?: string | null;
  pattern?: string | null;
};

/**
 * Creates a destinatario locally and (optionally) a single matching rule.
 * Both inserts + sync_queue entries run in one SQLite transaction.
 * Mirrors webapp/src/actions/destinatarios.ts `createDestinatario` shape.
 */
export async function createDestinatarioWithPattern(
  params: CreateDestinatarioParams
): Promise<{ destinatarioId: string; ruleId: string | null }> {
  const db = await getDatabase();
  const destinatarioId = Crypto.randomUUID();
  const ruleId = params.pattern?.trim() ? Crypto.randomUUID() : null;
  const now = new Date().toISOString();

  const destPayload = {
    id: destinatarioId,
    user_id: params.user_id,
    name: params.name,
    default_category_id: params.default_category_id ?? null,
    notes: params.notes ?? null,
    is_active: true,
    created_at: now,
    updated_at: now,
  };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO destinatarios
        (id, user_id, name, default_category_id, notes, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        destPayload.id,
        destPayload.user_id,
        destPayload.name,
        destPayload.default_category_id,
        destPayload.notes,
        now,
        now,
      ]
    );
    await enqueueInsert(db, "destinatarios", destinatarioId, destPayload, now);

    if (ruleId && params.pattern) {
      const rulePayload = {
        id: ruleId,
        user_id: params.user_id,
        destinatario_id: destinatarioId,
        pattern: params.pattern.trim(),
        match_type: "contains" as const,
        priority: 100,
      };

      await db.runAsync(
        `INSERT INTO destinatario_rules
          (id, user_id, destinatario_id, pattern, match_type, priority, match_count, created_at)
         VALUES (?, ?, ?, ?, 'contains', 100, 0, ?)`,
        [
          rulePayload.id,
          rulePayload.user_id,
          rulePayload.destinatario_id,
          rulePayload.pattern,
          now,
        ]
      );
      await enqueueInsert(db, "destinatario_rules", ruleId, rulePayload, now);
    }
  });

  return { destinatarioId, ruleId };
}

export type UpdateDestinatarioParams = {
  name: string;
  default_category_id?: string | null;
  notes?: string | null;
  is_active?: boolean;
};

/**
 * Update a destinatario's editable fields + enqueue the sync UPDATE. `name_hmac`
 * is recomputed server-side from the (encrypted) name on the next sync, exactly
 * as on create — mobile sends plaintext name only. Mirrors webapp
 * `updateDestinatario` (its other effects are Next.js cache revalidation only).
 */
export async function updateDestinatario(
  id: string,
  params: UpdateDestinatarioParams
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const fields = {
    name: params.name,
    default_category_id: params.default_category_id ?? null,
    notes: params.notes ?? null,
    is_active: params.is_active ?? true,
    updated_at: now,
  };
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE destinatarios
         SET name = ?, default_category_id = ?, notes = ?, is_active = ?, updated_at = ?
       WHERE id = ?`,
      [
        fields.name,
        fields.default_category_id,
        fields.notes,
        fields.is_active ? 1 : 0,
        now,
        id,
      ]
    );
    await enqueueUpdate(db, "destinatarios", id, fields, now);
  });
}

/**
 * Add a matching rule (pattern) to a destinatario + enqueue the sync INSERT.
 * Mirrors webapp `addDestinatarioRule` (its findPatternConflicts is an advisory
 * check + cache revalidation only). user_id is derived from the destinatario.
 */
export async function addDestinatarioRule(params: {
  destinatario_id: string;
  pattern: string;
  match_type?: "contains" | "exact";
  priority?: number;
}): Promise<string> {
  const db = await getDatabase();
  const owner = await db.getFirstAsync<{ user_id: string }>(
    "SELECT user_id FROM destinatarios WHERE id = ?",
    [params.destinatario_id]
  );
  if (!owner) throw new Error("Destinatario no encontrado.");
  // Mirror Supabase's UNIQUE INDEX ON (user_id, lower(pattern)) — case-insensitive.
  // Pre-check prevents a ghost local row: without this, a duplicate is accepted
  // into SQLite then silently dropped on push (23505 skip), leaving a rule
  // visible in the UI with no Supabase counterpart. Surfaces the same error
  // the webapp shows immediately.
  const dup = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM destinatario_rules WHERE user_id = ? AND lower(pattern) = lower(?)",
    [owner.user_id, params.pattern]
  );
  if (dup) throw new Error("Este patrón ya está en uso.");
  const id = Crypto.randomUUID();
  const matchType = params.match_type ?? "contains";
  const priority = params.priority ?? 100;
  const now = new Date().toISOString();
  const payload = {
    id,
    user_id: owner.user_id,
    destinatario_id: params.destinatario_id,
    pattern: params.pattern,
    match_type: matchType,
    priority,
  };
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO destinatario_rules
        (id, user_id, destinatario_id, pattern, match_type, priority, match_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [id, owner.user_id, params.destinatario_id, params.pattern, matchType, priority, now]
    );
    await enqueueInsert(db, "destinatario_rules", id, payload, now);
  });
  return id;
}

/** Delete a destinatario matching rule + enqueue the sync DELETE. */
export async function deleteDestinatarioRule(ruleId: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM destinatario_rules WHERE id = ?", [ruleId]);
    await enqueueDelete(db, "destinatario_rules", ruleId, now);
  });
}
