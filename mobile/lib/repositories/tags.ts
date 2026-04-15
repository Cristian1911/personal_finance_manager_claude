import * as Crypto from "expo-crypto";
import { getDatabase } from "../db/database";

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

/** Generate a URL-safe slug. Must match webapp's generateSlug exactly. */
function generateSlug(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export async function createTagGroup(
  userId: string,
  name: string,
  color: string | null
): Promise<string> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO tag_groups (id, user_id, name, color, display_order, is_system, created_at)
     VALUES (?, ?, ?, ?, 999, 0, ?)`,
    [id, userId, name, color, now]
  );

  await db.runAsync(
    `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
     VALUES ('tag_groups', ?, 'INSERT', ?, ?)`,
    [id, JSON.stringify({ id, user_id: userId, name, color, is_system: false, created_at: now }), now]
  );

  return id;
}

export async function updateTagGroup(
  id: string,
  name: string,
  color: string | null
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    "UPDATE tag_groups SET name = ?, color = ? WHERE id = ?",
    [name, color, id]
  );

  const payload = { name, color };

  // Coalesce with pending INSERT if it hasn't synced yet
  const pendingInsert = await db.getFirstAsync<{ id: number; payload: string }>(
    `SELECT id, payload FROM sync_queue
     WHERE table_name = 'tag_groups' AND record_id = ? AND operation = 'INSERT' AND synced_at IS NULL`,
    [id]
  );

  if (pendingInsert) {
    const existing = JSON.parse(pendingInsert.payload);
    await db.runAsync("UPDATE sync_queue SET payload = ? WHERE id = ?", [
      JSON.stringify({ ...existing, ...payload }),
      pendingInsert.id,
    ]);
  } else {
    await db.runAsync(
      `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
       VALUES ('tag_groups', ?, 'UPDATE', ?, ?)`,
      [id, JSON.stringify(payload), now]
    );
  }
}

export async function deleteTagGroup(id: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  // Guard: never delete system groups
  const row = await db.getFirstAsync<{ is_system: number }>(
    "SELECT is_system FROM tag_groups WHERE id = ?",
    [id]
  );
  if (!row || row.is_system === 1) return;

  // Collect child tag IDs before unlinking
  const childTags = await db.getAllAsync<{ id: string }>(
    "SELECT id FROM tags WHERE group_id = ?",
    [id]
  );

  // Unlink tags from this group locally
  await db.runAsync("UPDATE tags SET group_id = NULL WHERE group_id = ?", [id]);

  // Fix any pending unsynced INSERT payloads for child tags — null out group_id
  for (const child of childTags) {
    const pendingChildInsert = await db.getFirstAsync<{ id: number; payload: string }>(
      `SELECT id, payload FROM sync_queue
       WHERE table_name = 'tags' AND record_id = ? AND operation = 'INSERT' AND synced_at IS NULL`,
      [child.id]
    );
    if (pendingChildInsert) {
      const existing = JSON.parse(pendingChildInsert.payload);
      await db.runAsync("UPDATE sync_queue SET payload = ? WHERE id = ?", [
        JSON.stringify({ ...existing, group_id: null }),
        pendingChildInsert.id,
      ]);
    }
  }

  const pendingInsert = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM sync_queue WHERE table_name = 'tag_groups' AND record_id = ? AND operation = 'INSERT' AND synced_at IS NULL`,
    [id]
  );

  await db.runAsync("DELETE FROM tag_groups WHERE id = ?", [id]);

  if (pendingInsert) {
    // Never synced — remove all pending operations for this group
    await db.runAsync(
      "DELETE FROM sync_queue WHERE table_name = 'tag_groups' AND record_id = ? AND synced_at IS NULL",
      [id]
    );
  } else {
    await db.runAsync(
      `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
       VALUES ('tag_groups', ?, 'DELETE', ?, ?)`,
      [id, JSON.stringify({ id }), now]
    );
  }
}

export async function createTag(
  userId: string,
  name: string,
  groupId: string | null,
  color: string | null
): Promise<string> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const slug = generateSlug(name);
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO tags (id, user_id, name, slug, color, group_id, display_order, is_system, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 999, 0, ?)`,
    [id, userId, name, slug, color, groupId, now]
  );

  await db.runAsync(
    `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
     VALUES ('tags', ?, 'INSERT', ?, ?)`,
    [id, JSON.stringify({ id, user_id: userId, name, slug, color, group_id: groupId, is_system: false, created_at: now }), now]
  );

  return id;
}

export async function updateTag(
  id: string,
  name: string,
  groupId: string | null,
  color: string | null
): Promise<void> {
  const db = await getDatabase();
  const slug = generateSlug(name);
  const now = new Date().toISOString();

  await db.runAsync(
    "UPDATE tags SET name = ?, slug = ?, color = ?, group_id = ? WHERE id = ?",
    [name, slug, color, groupId, id]
  );

  const payload = { name, slug, color, group_id: groupId };

  // Coalesce with pending INSERT if it hasn't synced yet
  const pendingInsert = await db.getFirstAsync<{ id: number; payload: string }>(
    `SELECT id, payload FROM sync_queue
     WHERE table_name = 'tags' AND record_id = ? AND operation = 'INSERT' AND synced_at IS NULL`,
    [id]
  );

  if (pendingInsert) {
    const existing = JSON.parse(pendingInsert.payload);
    await db.runAsync("UPDATE sync_queue SET payload = ? WHERE id = ?", [
      JSON.stringify({ ...existing, ...payload }),
      pendingInsert.id,
    ]);
  } else {
    await db.runAsync(
      `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
       VALUES ('tags', ?, 'UPDATE', ?, ?)`,
      [id, JSON.stringify(payload), now]
    );
  }
}

export async function deleteTag(id: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  // Guard: never delete system tags
  const row = await db.getFirstAsync<{ is_system: number }>(
    "SELECT is_system FROM tags WHERE id = ?",
    [id]
  );
  if (!row || row.is_system === 1) return;

  // Remove from junction table
  await db.runAsync("DELETE FROM transaction_tags WHERE tag_id = ?", [id]);

  const pendingInsert = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM sync_queue WHERE table_name = 'tags' AND record_id = ? AND operation = 'INSERT' AND synced_at IS NULL`,
    [id]
  );

  await db.runAsync("DELETE FROM tags WHERE id = ?", [id]);

  if (pendingInsert) {
    // Never synced — remove all pending operations for this tag
    await db.runAsync(
      "DELETE FROM sync_queue WHERE table_name = 'tags' AND record_id = ? AND synced_at IS NULL",
      [id]
    );
  } else {
    await db.runAsync(
      `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
       VALUES ('tags', ?, 'DELETE', ?, ?)`,
      [id, JSON.stringify({ id }), now]
    );
  }
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

    // Enqueue sync — send tag_ids array as payload for the syncer to handle
    await db.runAsync(
      `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
       VALUES ('transaction_tags', ?, 'REPLACE', ?, ?)`,
      [transactionId, JSON.stringify({ transaction_id: transactionId, tag_ids: tagIds }), now]
    );
  });
}
