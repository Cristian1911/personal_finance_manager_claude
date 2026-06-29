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
