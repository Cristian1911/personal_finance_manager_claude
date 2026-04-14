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
