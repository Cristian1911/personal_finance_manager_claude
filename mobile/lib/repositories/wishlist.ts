import * as Crypto from "expo-crypto";
import { getDatabase } from "../db/database";

export type WishlistItemRow = {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  currency_code: string;
  status: string;
  desire_type: string | null;
  urgency: string | null;
  why: string | null;
  url: string | null;
  image_url: string | null;
  funding_type: string | null;
  installments: number | null;
  account_id: string | null;
  category_id: string | null;
  transaction_id: string | null;
  last_score: number | null;
  last_scored_at: string | null;
  last_verdict: string | null;
  last_nudge_dismissed_at: string | null;
  enriched: number;
  enriched_at: string | null;
  ready_at: string | null;
  bought_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WishlistItemWithCategory = WishlistItemRow & {
  category_name: string | null;
};

export async function getActiveWishlistItems(): Promise<WishlistItemWithCategory[]> {
  const db = await getDatabase();
  return db.getAllAsync<WishlistItemWithCategory>(
    `SELECT
      w.*,
      COALESCE(c.name_es, c.name) AS category_name
    FROM wishlist_items w
    LEFT JOIN categories c ON w.category_id = c.id
    WHERE w.status IN ('WANT', 'SAVING', 'READY')
    ORDER BY
      CASE w.urgency
        WHEN 'HIGH' THEN 1
        WHEN 'MEDIUM' THEN 2
        WHEN 'LOW' THEN 3
        ELSE 4
      END,
      w.created_at DESC`
  );
}

export async function getBoughtWishlistItems(): Promise<WishlistItemWithCategory[]> {
  const db = await getDatabase();
  return db.getAllAsync<WishlistItemWithCategory>(
    `SELECT
      w.*,
      COALESCE(c.name_es, c.name) AS category_name
    FROM wishlist_items w
    LEFT JOIN categories c ON w.category_id = c.id
    WHERE w.status = 'BOUGHT'
    ORDER BY w.bought_at DESC
    LIMIT 20`
  );
}

export async function getWishlistSummary() {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    total_items: number;
    total_amount: number;
    want_count: number;
    saving_count: number;
    ready_count: number;
  }>(
    `SELECT
      COUNT(*) AS total_items,
      COALESCE(SUM(amount), 0) AS total_amount,
      COALESCE(SUM(CASE WHEN status = 'WANT' THEN 1 ELSE 0 END), 0) AS want_count,
      COALESCE(SUM(CASE WHEN status = 'SAVING' THEN 1 ELSE 0 END), 0) AS saving_count,
      COALESCE(SUM(CASE WHEN status = 'READY' THEN 1 ELSE 0 END), 0) AS ready_count
    FROM wishlist_items
    WHERE status IN ('WANT', 'SAVING', 'READY')`
  );
  return row ?? { total_items: 0, total_amount: 0, want_count: 0, saving_count: 0, ready_count: 0 };
}

export async function createWishlistItem(params: {
  user_id: string;
  name: string;
  amount: number;
  currency_code?: string;
  urgency?: string;
  why?: string;
  url?: string;
  category_id?: string;
}): Promise<string> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO wishlist_items
      (id, user_id, name, amount, currency_code, status, urgency, why, url, category_id, enriched, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'WANT', ?, ?, ?, ?, 0, ?, ?)`,
    [
      id, params.user_id, params.name, params.amount,
      params.currency_code ?? "COP",
      params.urgency ?? null, params.why ?? null,
      params.url ?? null, params.category_id ?? null,
      now, now,
    ]
  );

  await db.runAsync(
    `INSERT INTO sync_queue (table_name, record_id, operation, payload, created_at)
     VALUES ('wishlist_items', ?, 'INSERT', ?, ?)`,
    [
      id,
      JSON.stringify({
        id, user_id: params.user_id, name: params.name,
        amount: params.amount, currency_code: params.currency_code ?? "COP",
        status: "WANT", urgency: params.urgency ?? null,
        why: params.why ?? null, url: params.url ?? null,
        category_id: params.category_id ?? null,
        enriched: false, created_at: now, updated_at: now,
      }),
      now,
    ]
  );

  return id;
}
