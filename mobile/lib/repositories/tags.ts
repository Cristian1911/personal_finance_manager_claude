import * as Crypto from "expo-crypto";
import { getDatabase } from "../db/database";
import { enqueueInsert, enqueueUpdate, enqueueDelete } from "../sync/queue";

// Ported from webapp `generateSlug` (webapp/src/lib/utils/string.ts) — not in
// @zeta/shared, so mirrored here to keep tag slugs byte-identical across platforms.
function slugify(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export type TagGroupRow = {
  id: string;
  user_id: string | null;
  name: string;
  color: string | null;
  display_order: number;
  is_system: number;
  created_at: string;
};

export type TagRow = {
  id: string;
  user_id: string | null;
  name: string;
  slug: string;
  color: string | null;
  group_id: string | null;
  display_order: number;
  is_system: number;
  created_at: string;
};

export type TagWithGroup = TagRow & {
  group_name: string | null;
  group_color: string | null;
};

export async function getAllTagGroups(): Promise<TagGroupRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<TagGroupRow>(
    "SELECT * FROM tag_groups ORDER BY display_order"
  );
}

export async function getAllTags(): Promise<TagWithGroup[]> {
  const db = await getDatabase();
  return db.getAllAsync<TagWithGroup>(
    `SELECT
      t.*,
      g.name AS group_name,
      g.color AS group_color
    FROM tags t
    LEFT JOIN tag_groups g ON t.group_id = g.id
    ORDER BY t.display_order`
  );
}

export async function getTagsForTransaction(
  transactionId: string
): Promise<TagRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<TagRow>(
    `SELECT t.* FROM tags t
     JOIN transaction_tags tt ON tt.tag_id = t.id
     WHERE tt.transaction_id = ?
     ORDER BY t.display_order`,
    [transactionId]
  );
}

/**
 * Replace all tags for a transaction.
 * Deletes existing junction rows and re-inserts the given tagIds.
 * Also enqueues a sync operation.
 */
export async function saveTransactionTags(
  transactionId: string,
  tagIds: string[]
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  // The transaction_tags REPLACE sync payload needs user_id — the remote table is
  // NOT-NULL + RLS, so without it the push insert fails forever (was only warned).
  // user_id is omitted from the LOCAL junction table (derivable), so look it up.
  const txRow = await db.getFirstAsync<{ user_id: string }>(
    "SELECT user_id FROM transactions WHERE id = ?",
    [transactionId]
  );

  await db.withTransactionAsync(async () => {
    // Remove existing tags
    await db.runAsync(
      "DELETE FROM transaction_tags WHERE transaction_id = ?",
      [transactionId]
    );

    // Insert new tags
    for (const tagId of tagIds) {
      await db.runAsync(
        "INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)",
        [transactionId, tagId]
      );
    }

    // Enqueue sync — include user_id so the remote REPLACE (NOT-NULL + RLS) lands.
    if (txRow?.user_id) {
      await db.runAsync(
        `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
         VALUES ('transaction_tags', ?, 'REPLACE', ?, ?)`,
        [
          transactionId,
          JSON.stringify({ transaction_id: transactionId, user_id: txRow.user_id, tag_ids: tagIds }),
          now,
        ]
      );
    } else {
      console.warn(
        `saveTransactionTags: tx ${transactionId} has no local user_id — tags saved locally, sync enqueue skipped`
      );
    }
  });
}

// ── Tag group mutations (mirror webapp actions/tags.ts) ───────────────────────

export async function createTagGroup(
  userId: string,
  name: string,
  color?: string | null
): Promise<string> {
  const trimmed = name.trim();
  if (trimmed.length < 1) throw new Error("El nombre es requerido");
  if (trimmed.length > 50)
    throw new Error("El nombre no puede superar 50 caracteres");
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  const orderRow = await db.getFirstAsync<{ m: number }>(
    "SELECT COALESCE(MAX(display_order), 0) + 1 AS m FROM tag_groups"
  );
  const displayOrder = orderRow?.m ?? 0;
  const payload = {
    id,
    user_id: userId,
    name: trimmed,
    color: color ?? null,
    display_order: displayOrder,
    is_system: false,
    created_at: now,
  };
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO tag_groups (id, user_id, name, color, display_order, is_system, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
      [id, userId, trimmed, color ?? null, displayOrder, now]
    );
    await enqueueInsert(db, "tag_groups", id, payload, now);
  });
  return id;
}

/** Update a user tag group. System groups (is_system=1) are protected. */
export async function updateTagGroup(
  id: string,
  name: string,
  color?: string | null
): Promise<void> {
  const trimmed = name.trim();
  if (trimmed.length < 1) throw new Error("El nombre es requerido");
  if (trimmed.length > 50)
    throw new Error("El nombre no puede superar 50 caracteres");
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE tag_groups SET name = ?, color = ? WHERE id = ? AND is_system = 0`,
      [trimmed, color ?? null, id]
    );
    await enqueueUpdate(db, "tag_groups", id, { name: trimmed, color: color ?? null }, now);
  });
}

/**
 * Delete a user tag group. Mirrors the remote `ON DELETE SET NULL` on
 * tags.group_id: locally null out child tags first (FK is ON), then delete the
 * group. Remote applies SET NULL itself, so the child updates are not enqueued.
 */
export async function deleteTagGroup(id: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  // Defense-in-depth: bail before touching child rows / enqueueing if the row
  // is system-owned — remote RLS would no-op the push and local would drift.
  const row = await db.getFirstAsync<{ is_system: number }>(
    "SELECT is_system FROM tag_groups WHERE id = ?",
    [id]
  );
  if (!row || row.is_system) return;
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE tags SET group_id = NULL WHERE group_id = ?", [id]);
    await db.runAsync("DELETE FROM tag_groups WHERE id = ? AND is_system = 0", [id]);
    await enqueueDelete(db, "tag_groups", id, now);
  });
}

// ── Tag mutations ─────────────────────────────────────────────────────────────

export async function createTag(
  userId: string,
  name: string,
  groupId?: string | null
): Promise<string> {
  const trimmed = name.trim();
  if (trimmed.length < 1) throw new Error("El nombre es requerido");
  if (trimmed.length > 50)
    throw new Error("El nombre no puede superar 50 caracteres");
  const db = await getDatabase();
  const slug = slugify(trimmed);
  // Mirror the remote UNIQUE (user_id, slug) so we don't create a local row the
  // push would reject with 23505 (which would drift local ahead of remote).
  const existing = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM tags WHERE user_id = ? AND slug = ?",
    [userId, slug]
  );
  if (existing) throw new Error("Ya existe una etiqueta con ese nombre");

  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  const orderRow = await db.getFirstAsync<{ m: number }>(
    "SELECT COALESCE(MAX(display_order), 0) + 1 AS m FROM tags"
  );
  const displayOrder = orderRow?.m ?? 0;
  const payload = {
    id,
    user_id: userId,
    name: trimmed,
    slug,
    color: null,
    group_id: groupId ?? null,
    display_order: displayOrder,
    is_system: false,
    created_at: now,
  };
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO tags (id, user_id, name, slug, color, group_id, display_order, is_system, created_at)
       VALUES (?, ?, ?, ?, NULL, ?, ?, 0, ?)`,
      [id, userId, trimmed, slug, groupId ?? null, displayOrder, now]
    );
    await enqueueInsert(db, "tags", id, payload, now);
  });
  return id;
}

/**
 * Delete a user tag. Mirrors remote `ON DELETE CASCADE` on transaction_tags:
 * locally remove junction rows first (FK is ON), then delete the tag. Remote
 * cascades on its own, so junction deletes are not enqueued.
 */
export async function deleteTag(id: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  // Defense-in-depth: see deleteTagGroup — never mutate children or enqueue
  // for a system row.
  const row = await db.getFirstAsync<{ is_system: number }>(
    "SELECT is_system FROM tags WHERE id = ?",
    [id]
  );
  if (!row || row.is_system) return;
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM transaction_tags WHERE tag_id = ?", [id]);
    await db.runAsync("DELETE FROM tags WHERE id = ? AND is_system = 0", [id]);
    await enqueueDelete(db, "tags", id, now);
  });
}
