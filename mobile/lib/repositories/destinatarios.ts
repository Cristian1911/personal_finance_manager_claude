import * as Crypto from "expo-crypto";
import { getDatabase } from "../db/database";
import { enqueueInsert } from "../sync/queue";

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
