import * as Crypto from "expo-crypto";
import { getDatabase } from "../db/database";
import { enqueueDelete, enqueueInsert, enqueueUpdate } from "../sync/queue";

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
    WHERE w.status = 'wishlist'
    ORDER BY
      CASE w.urgency
        WHEN 'NECESSARY' THEN 1
        WHEN 'USEFUL' THEN 2
        WHEN 'IMPULSE' THEN 3
        ELSE 4
      END,
      w.created_at DESC`
  );
}

export async function getWishlistItemById(
  id: string,
  user_id: string
): Promise<WishlistItemWithCategory | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<WishlistItemWithCategory>(
    `SELECT
      w.*,
      COALESCE(c.name_es, c.name) AS category_name
    FROM wishlist_items w
    LEFT JOIN categories c ON w.category_id = c.id
    WHERE w.id = ? AND w.user_id = ?
    LIMIT 1`,
    [id, user_id]
  );
  return row ?? null;
}

export async function getBoughtWishlistItems(): Promise<WishlistItemWithCategory[]> {
  const db = await getDatabase();
  // Include 'reflected' — webapp transitions bought → reflected after the user
  // submits a reflection. Without this, reflected purchases vanish from
  // mobile's history.
  return db.getAllAsync<WishlistItemWithCategory>(
    `SELECT
      w.*,
      COALESCE(c.name_es, c.name) AS category_name
    FROM wishlist_items w
    LEFT JOIN categories c ON w.category_id = c.id
    WHERE w.status IN ('bought', 'reflected')
    ORDER BY w.bought_at DESC
    LIMIT 20`
  );
}

export async function getWishlistCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM wishlist_items WHERE status = 'wishlist'"
  );
  return row?.count ?? 0;
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
      COUNT(*) AS want_count,
      0 AS saving_count,
      0 AS ready_count
    FROM wishlist_items
    WHERE status = 'wishlist'`
  );
  return row ?? { total_items: 0, total_amount: 0, want_count: 0, saving_count: 0, ready_count: 0 };
}

export type CreateWishlistItemParams = {
  user_id: string;
  name: string;
  amount: number;
  currency_code?: string;
  status?: "wishlist" | "bought";
  urgency?: string | null;
  desire_type?: string | null;
  why?: string | null;
  url?: string | null;
  funding_type?: string | null;
  installments?: number | null;
  account_id?: string | null;
  category_id?: string | null;
  last_score?: number | null;
  last_verdict?: string | null;
  enriched?: boolean;
};

export async function createWishlistItem(
  params: CreateWishlistItemParams
): Promise<string> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  const status = params.status ?? "wishlist";
  const enriched = params.enriched ?? false;
  const lastScoredAt = params.last_score != null ? now : null;
  const enrichedAt = enriched ? now : null;

  const payload = {
    id,
    user_id: params.user_id,
    name: params.name,
    amount: params.amount,
    currency_code: params.currency_code ?? "COP",
    status,
    urgency: params.urgency ?? null,
    desire_type: params.desire_type ?? null,
    why: params.why ?? null,
    url: params.url ?? null,
    funding_type: params.funding_type ?? null,
    installments: params.installments ?? null,
    account_id: params.account_id ?? null,
    category_id: params.category_id ?? null,
    last_score: params.last_score ?? null,
    last_scored_at: lastScoredAt,
    last_verdict: params.last_verdict ?? null,
    enriched,
    enriched_at: enrichedAt,
    created_at: now,
    updated_at: now,
  };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO wishlist_items
        (id, user_id, name, amount, currency_code, status,
         urgency, desire_type, why, url,
         funding_type, installments, account_id, category_id,
         last_score, last_scored_at, last_verdict,
         enriched, enriched_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.id, payload.user_id, payload.name, payload.amount,
        payload.currency_code, payload.status,
        payload.urgency, payload.desire_type, payload.why, payload.url,
        payload.funding_type, payload.installments,
        payload.account_id, payload.category_id,
        payload.last_score, payload.last_scored_at, payload.last_verdict,
        enriched ? 1 : 0, payload.enriched_at,
        payload.created_at, payload.updated_at,
      ]
    );

    await enqueueInsert(db, "wishlist_items", id, payload, now);
  });

  return id;
}

export type EnrichWishlistItemParams = {
  id: string;
  user_id: string;
  why: string | null;
  urgency: string;
  desire_type: string;
  funding_type: string;
  installments: number | null;
  account_id: string | null;
  category_id?: string | null;
};

export async function enrichWishlistItem(
  params: EnrichWishlistItemParams
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const update = {
    why: params.why,
    urgency: params.urgency,
    desire_type: params.desire_type,
    funding_type: params.funding_type,
    installments:
      params.funding_type === "INSTALLMENTS" ? params.installments : null,
    account_id: params.account_id,
    category_id: params.category_id ?? null,
    enriched: true,
    enriched_at: now,
    updated_at: now,
  };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE wishlist_items
         SET why = ?, urgency = ?, desire_type = ?, funding_type = ?,
             installments = ?, account_id = ?, category_id = ?,
             enriched = 1, enriched_at = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
      [
        update.why, update.urgency, update.desire_type, update.funding_type,
        update.installments, update.account_id, update.category_id,
        now, now,
        params.id, params.user_id,
      ]
    );

    await enqueueUpdate(db, "wishlist_items", params.id, { id: params.id, ...update }, now);
  });
}

export async function persistWishlistScore(params: {
  id: string;
  user_id: string;
  last_score: number;
  last_verdict: string;
  /** When transitioning from non-green → green for the first time, set ready_at. */
  ready_at?: string | null;
}): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  // COALESCE preserves the existing ready_at when the caller passes null/undefined,
  // so we collapse the "set ready_at" and "leave ready_at" branches into one query.
  const update: Record<string, unknown> = {
    last_score: params.last_score,
    last_verdict: params.last_verdict,
    last_scored_at: now,
    updated_at: now,
  };
  if (params.ready_at) update.ready_at = params.ready_at;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE wishlist_items
         SET last_score = ?, last_verdict = ?, last_scored_at = ?,
             ready_at = COALESCE(?, ready_at), updated_at = ?
       WHERE id = ? AND user_id = ?`,
      [
        params.last_score, params.last_verdict, now,
        params.ready_at ?? null, now,
        params.id, params.user_id,
      ]
    );
    await enqueueUpdate(db, "wishlist_items", params.id, { id: params.id, ...update }, now);
  });
}

export async function markWishlistItemBought(params: {
  id: string;
  user_id: string;
  transaction_id?: string | null;
}): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const update = {
    status: "bought",
    bought_at: now,
    transaction_id: params.transaction_id ?? null,
    updated_at: now,
  };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE wishlist_items
         SET status = 'bought', bought_at = ?, transaction_id = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
      [now, update.transaction_id, now, params.id, params.user_id]
    );

    await enqueueUpdate(db, "wishlist_items", params.id, { id: params.id, ...update }, now);
  });
}

export async function dismissWishlistNudge(params: {
  id: string;
  user_id: string;
}): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const update = { last_nudge_dismissed_at: now, updated_at: now };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE wishlist_items
         SET last_nudge_dismissed_at = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
      [now, now, params.id, params.user_id]
    );

    await enqueueUpdate(db, "wishlist_items", params.id, { id: params.id, ...update }, now);
  });
}

export async function deleteWishlistItem(params: {
  id: string;
  user_id: string;
}): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "DELETE FROM wishlist_items WHERE id = ? AND user_id = ?",
      [params.id, params.user_id]
    );
    await enqueueDelete(db, "wishlist_items", params.id, now);
  });
}
