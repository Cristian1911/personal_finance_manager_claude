import * as Crypto from "expo-crypto";
import { cleanDescription, type DestinatarioRule } from "@zeta/shared";
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
  // Required (not optional) — the UPDATE writes every column, so an omitted
  // field would wipe the existing value. Callers must pass the full set.
  default_category_id: string | null;
  notes: string | null;
  is_active: boolean;
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

// ── D3: merge ─────────────────────────────────────────────────────────────────

/**
 * Merge `sourceIds` into `targetId`, mirroring webapp `mergeDestinatarios`
 * exactly: reassign transactions, reassign rules, delete sources.
 *
 * The source delete also mirrors the remote FK actions locally (FKs are ON in
 * SQLite and default to NO ACTION, so without this the delete would throw):
 * - subscriptions.destinatario_id      → remote ON DELETE CASCADE  → local DELETE
 * - recurring_templates.destinatario_id → remote ON DELETE SET NULL → local NULL
 * - personal_debts.destinatario_id     → remote ON DELETE RESTRICT → pre-check +
 *   abort (the webapp merge fails identically; we just say it in Spanish)
 * None of these child ops are enqueued — remote applies its own FK actions.
 *
 * Rule reassignment dedups locally against the target's `lower(pattern)` set:
 * the remote UNIQUE(user_id, lower(pattern)) makes a colliding UPDATE fail,
 * and the push UPDATE path does NOT swallow 23505 — it would retry forever.
 * A colliding source rule is deleted instead (same net state the webapp
 * reaches via its ON CONFLICT skip + source delete).
 */
export async function mergeDestinatarios(
  targetId: string,
  sourceIds: string[]
): Promise<void> {
  if (sourceIds.length === 0 || sourceIds.includes(targetId)) return;
  const db = await getDatabase();
  const now = new Date().toISOString();
  const placeholders = sourceIds.map(() => "?").join(", ");

  // Remote personal_debts FK is ON DELETE RESTRICT — fail fast with a clear
  // message instead of a raw FK error mid-transaction.
  const debtRow = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM personal_debts WHERE destinatario_id IN (${placeholders}) LIMIT 1`,
    sourceIds
  );
  if (debtRow) {
    throw new Error(
      "No se puede fusionar: uno de los destinatarios tiene deudas personales vinculadas."
    );
  }

  const txs = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM transactions WHERE destinatario_id IN (${placeholders})`,
    sourceIds
  );
  const sourceRules = await db.getAllAsync<{ id: string; pattern: string }>(
    `SELECT id, pattern FROM destinatario_rules WHERE destinatario_id IN (${placeholders})`,
    sourceIds
  );
  const targetRules = await db.getAllAsync<{ pattern: string }>(
    "SELECT pattern FROM destinatario_rules WHERE destinatario_id = ?",
    [targetId]
  );
  const targetPatterns = new Set(
    targetRules.map((r) => r.pattern.toLowerCase())
  );

  await db.withTransactionAsync(async () => {
    // Bulk local UPDATE (one write instead of N), then per-row enqueue — the
    // remote push still needs one sync_queue row per transaction.
    if (txs.length > 0) {
      await db.runAsync(
        `UPDATE transactions SET destinatario_id = ?, updated_at = ?
         WHERE destinatario_id IN (${placeholders})`,
        [targetId, now, ...sourceIds]
      );
      for (const tx of txs) {
        await enqueueUpdate(db, "transactions", tx.id, {
          destinatario_id: targetId,
          updated_at: now,
        }, now);
      }
    }

    for (const rule of sourceRules) {
      if (targetPatterns.has(rule.pattern.toLowerCase())) {
        await db.runAsync("DELETE FROM destinatario_rules WHERE id = ?", [rule.id]);
        await enqueueDelete(db, "destinatario_rules", rule.id, now);
      } else {
        await db.runAsync(
          "UPDATE destinatario_rules SET destinatario_id = ? WHERE id = ?",
          [targetId, rule.id]
        );
        await enqueueUpdate(db, "destinatario_rules", rule.id, {
          destinatario_id: targetId,
        }, now);
        targetPatterns.add(rule.pattern.toLowerCase());
      }
    }

    // Mirror remote FK actions before the source delete (not enqueued —
    // remote CASCADE/SET NULL apply server-side on the destinatarios delete).
    await db.runAsync(
      `DELETE FROM subscriptions WHERE destinatario_id IN (${placeholders})`,
      sourceIds
    );
    await db.runAsync(
      `UPDATE recurring_transaction_templates SET destinatario_id = NULL
       WHERE destinatario_id IN (${placeholders})`,
      sourceIds
    );

    await db.runAsync(
      `DELETE FROM destinatarios WHERE id IN (${placeholders})`,
      sourceIds
    );
    for (const sourceId of sourceIds) {
      await enqueueDelete(db, "destinatarios", sourceId, now);
    }
  });
}

// ── D4: sugerencias ───────────────────────────────────────────────────────────

/** Shape mirrors webapp `DestinatarioSuggestionResult`. */
export type DestinatarioSuggestionResult = {
  cleanedPattern: string;
  count: number;
  dateRange: { from: string; to: string };
  sampleTransactions: { date: string; rawDescription: string; amount: number }[];
};

const DISMISSAL_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días — igual que el webapp

/**
 * Faithful port of webapp `getDestinatarioSuggestionsCached`: group unmatched
 * transactions by cleanDescription counting ROWS (not unique descriptions —
 * the shared detector counts uniques, which under-counts identical repeated
 * charges like NETFLIX.COM ×5), keep count >= 3, merge by common token prefix
 * (>= 2 tokens), sort by count, cap 20. Dismissals filtered device-locally.
 */
export async function getDestinatarioSuggestions(): Promise<
  DestinatarioSuggestionResult[]
> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    transaction_date: string;
    raw_description: string;
    amount: number;
  }>(
    `SELECT transaction_date, raw_description, amount FROM transactions
     WHERE destinatario_id IS NULL AND raw_description IS NOT NULL
     ORDER BY transaction_date DESC LIMIT 1000`
  );

  const cutoff = new Date(Date.now() - DISMISSAL_TTL_MS).toISOString();
  const dismissed = await db.getAllAsync<{ pattern: string }>(
    "SELECT pattern FROM destinatario_suggestion_dismissals WHERE dismissed_at >= ?",
    [cutoff]
  );
  const dismissedSet = new Set(dismissed.map((d) => d.pattern));

  const groups = new Map<
    string,
    {
      count: number;
      dates: string[];
      samples: { date: string; rawDescription: string; amount: number }[];
    }
  >();
  for (const row of rows) {
    const cleaned = cleanDescription(row.raw_description);
    if (cleaned.length === 0) continue;
    if (!groups.has(cleaned)) {
      groups.set(cleaned, { count: 0, dates: [], samples: [] });
    }
    const group = groups.get(cleaned)!;
    group.count++;
    group.dates.push(row.transaction_date);
    if (group.samples.length < 5) {
      group.samples.push({
        date: row.transaction_date,
        rawDescription: row.raw_description,
        amount: row.amount,
      });
    }
  }

  const suggestions: DestinatarioSuggestionResult[] = [];
  for (const [pattern, group] of groups) {
    if (group.count < 3) continue;
    const sortedDates = group.dates.sort();
    suggestions.push({
      cleanedPattern: pattern,
      count: group.count,
      dateRange: { from: sortedDates[0], to: sortedDates[sortedDates.length - 1] },
      sampleTransactions: group.samples,
    });
  }
  suggestions.sort((a, b) => b.count - a.count);

  return groupSuggestionsByPrefix(suggestions)
    .filter((s) => !dismissedSet.has(s.cleanedPattern))
    .slice(0, 20);
}

// Port of the webapp's private groupSuggestionsByPrefix (actions/destinatarios.ts).
function groupSuggestionsByPrefix(
  suggestions: DestinatarioSuggestionResult[]
): DestinatarioSuggestionResult[] {
  if (suggestions.length <= 1) return suggestions;
  const sorted = [...suggestions].sort((a, b) =>
    a.cleanedPattern.localeCompare(b.cleanedPattern)
  );
  const groups: DestinatarioSuggestionResult[] = [];
  let current = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const tokensA = current.cleanedPattern.split(/\s+/);
    const tokensB = next.cleanedPattern.split(/\s+/);
    const common: string[] = [];
    for (let j = 0; j < Math.min(tokensA.length, tokensB.length); j++) {
      if (tokensA[j] === tokensB[j]) common.push(tokensA[j]);
      else break;
    }
    if (common.length >= 2) {
      current = {
        cleanedPattern: common.join(" "),
        count: current.count + next.count,
        dateRange: {
          from:
            current.dateRange.from < next.dateRange.from
              ? current.dateRange.from
              : next.dateRange.from,
          to:
            current.dateRange.to > next.dateRange.to
              ? current.dateRange.to
              : next.dateRange.to,
        },
        sampleTransactions: [
          ...current.sampleTransactions,
          ...next.sampleTransactions,
        ].slice(0, 5),
      };
    } else {
      groups.push(current);
      current = next;
    }
  }
  groups.push(current);
  groups.sort((a, b) => b.count - a.count);
  return groups;
}

/** Device-local dismissal (mirrors the webapp's localStorage, never synced). */
export async function dismissDestinatarioSuggestion(
  pattern: string
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO destinatario_suggestion_dismissals (pattern, dismissed_at)
     VALUES (?, ?)
     ON CONFLICT(pattern) DO UPDATE SET dismissed_at = excluded.dismissed_at`,
    [pattern, new Date().toISOString()]
  );
}

/**
 * Accept a suggestion: create destinatario + rule, then link matching
 * unmatched transactions — the webapp `createDestinatario` link path
 * (cleaned/raw `includes(lowerPattern)`, same candidate filters, limit 2000).
 * Divergence (documented): the webapp also renames `merchant_name` on
 * non-title_locked matches; mobile SQLite has no `title_locked` column, so the
 * rename is skipped — names converge via the destinatario itself.
 * Category side-effect is n/a: the mobile accept form takes no category, and
 * the webapp only categorizes when one is provided.
 */
export async function createDestinatarioFromSuggestion(params: {
  user_id: string;
  name: string;
  pattern: string;
}): Promise<{ destinatarioId: string; linkedCount: number }> {
  const { destinatarioId } = await createDestinatarioWithPattern({
    user_id: params.user_id,
    name: params.name,
    pattern: params.pattern,
  });

  const db = await getDatabase();
  const now = new Date().toISOString();
  const lowerPattern = params.pattern.trim().toLowerCase();
  const candidates = await db.getAllAsync<{
    id: string;
    raw_description: string;
  }>(
    `SELECT id, raw_description FROM transactions
     WHERE destinatario_id IS NULL
       AND raw_description IS NOT NULL
       AND is_excluded = 0
       AND reconciled_into_transaction_id IS NULL
     LIMIT 2000`
  );

  const matchingIds: string[] = [];
  for (const tx of candidates) {
    const cleaned = cleanDescription(tx.raw_description).toLowerCase();
    const raw = tx.raw_description.toLowerCase();
    if (cleaned.includes(lowerPattern) || raw.includes(lowerPattern)) {
      matchingIds.push(tx.id);
    }
  }

  if (matchingIds.length > 0) {
    await db.withTransactionAsync(async () => {
      for (const txId of matchingIds) {
        await db.runAsync(
          "UPDATE transactions SET destinatario_id = ?, updated_at = ? WHERE id = ?",
          [destinatarioId, now, txId]
        );
        await enqueueUpdate(db, "transactions", txId, {
          destinatario_id: destinatarioId,
          updated_at: now,
        }, now);
      }
    });
  }

  return { destinatarioId, linkedCount: matchingIds.length };
}
