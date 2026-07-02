import { getDatabase } from "../db/database";
import { enqueueUpdate } from "../sync/queue";

export type SubscriptionRow = {
  id: string;
  user_id: string;
  destinatario_id: string;
  recurring_template_id: string | null;
  status: string;
  estimated_amount: number | null;
  currency_code: string | null;
  trial_ends_on: string | null;
  cancel_url: string | null;
  detected_at: string | null;
  dismissed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionWithDetails = SubscriptionRow & {
  destinatario_name: string | null;
  template_amount: number | null;
  template_frequency: string | null;
};

/**
 * Returns live subscriptions (excludes dismissed and cancelled, includes
 * `suggested`), joined with destinatario name and recurring template details.
 * Mirrors webapp `getSubscriptions()` filters + ordering.
 */
export async function getActiveSubscriptions(): Promise<
  SubscriptionWithDetails[]
> {
  const db = await getDatabase();
  return db.getAllAsync<SubscriptionWithDetails>(
    `SELECT s.*,
       d.name AS destinatario_name,
       t.amount AS template_amount,
       t.frequency AS template_frequency
     FROM subscriptions s
     LEFT JOIN destinatarios d ON s.destinatario_id = d.id
     LEFT JOIN recurring_transaction_templates t ON s.recurring_template_id = t.id
     WHERE s.status NOT IN ('dismissed', 'cancelled')
     ORDER BY s.created_at DESC`
  );
}

/**
 * Current-month OUTFLOW occurrences (all statuses) — powers the hero's
 * occurrence-backed monthly total, mirroring the webapp suscripciones page
 * (`getOccurrencesForMonth` + `authoritativeMonthly`). Direction lives on the
 * template, so join it here.
 */
export async function getMonthlyOutflowOccurrences(
  monthStart: string,
  monthEnd: string
): Promise<{ template_id: string; expected_amount: number }[]> {
  const db = await getDatabase();
  return db.getAllAsync<{ template_id: string; expected_amount: number }>(
    `SELECT o.template_id, o.expected_amount
     FROM recurring_occurrences o
     JOIN recurring_transaction_templates t ON t.id = o.template_id
     WHERE o.occurrence_date >= ? AND o.occurrence_date <= ?
       AND t.direction = 'OUTFLOW'`,
    [monthStart, monthEnd]
  );
}

// ── Mutations (mirror webapp actions/subscriptions.ts) ────────────────────────
// Local write + enqueue inside one SQLite transaction; payloads carry only real
// remote columns + updated_at (push freshness check reads it).

/** suggested → active. Guarded to `suggested` like the webapp action. */
export async function confirmSubscription(id: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    const res = await db.runAsync(
      `UPDATE subscriptions SET status = 'active', updated_at = ?
       WHERE id = ? AND status = 'suggested'`,
      [now, id]
    );
    // Mirror the webapp's guard-miss error (surfaced by the caller's catch).
    if (res.changes === 0) throw new Error("La sugerencia ya no está disponible");
    await enqueueUpdate(db, "subscriptions", id, {
      status: "active",
      updated_at: now,
    }, now);
  });
}

/** any live status → dismissed (+ dismissed_at). */
export async function dismissSubscription(id: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    const res = await db.runAsync(
      `UPDATE subscriptions SET status = 'dismissed', dismissed_at = ?, updated_at = ?
       WHERE id = ? AND status != 'dismissed'`,
      [now, now, id]
    );
    if (res.changes === 0) return;
    await enqueueUpdate(db, "subscriptions", id, {
      status: "dismissed",
      dismissed_at: now,
      updated_at: now,
    }, now);
  });
}

/** active|trial → marked_for_cancellation. Guarded like the webapp action. */
export async function markForCancellation(id: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    const res = await db.runAsync(
      `UPDATE subscriptions SET status = 'marked_for_cancellation', updated_at = ?
       WHERE id = ? AND status IN ('active', 'trial')`,
      [now, id]
    );
    // Mirror the webapp's guard-miss error (surfaced by the caller's catch).
    if (res.changes === 0) throw new Error("La suscripción no está activa");
    await enqueueUpdate(db, "subscriptions", id, {
      status: "marked_for_cancellation",
      updated_at: now,
    }, now);
  });
}

/**
 * Cancel a subscription, mirroring the webapp exactly:
 * - Template-linked: the REAL write is the template `is_active=false` — the
 *   remote DB trigger (`sync_subscription_on_template_active_change`) cascades
 *   the remote subscription to `cancelled`. We set the LOCAL subscription row
 *   to cancelled for immediate UI, but do NOT enqueue a subscription UPDATE —
 *   the trigger owns the remote row; the next pull reconciles. (Enqueueing it
 *   would race the trigger-bumped remote updated_at and get skipped as stale.)
 * - Unlinked: plain status update on the subscription row, enqueued.
 */
export async function cancelSubscription(id: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const sub = await db.getFirstAsync<{
    recurring_template_id: string | null;
    status: string;
  }>("SELECT recurring_template_id, status FROM subscriptions WHERE id = ?", [
    id,
  ]);
  if (!sub || sub.status === "cancelled") return;

  await db.withTransactionAsync(async () => {
    if (sub.recurring_template_id) {
      await db.runAsync(
        `UPDATE recurring_transaction_templates SET is_active = 0, updated_at = ?
         WHERE id = ?`,
        [now, sub.recurring_template_id]
      );
      await enqueueUpdate(db, "recurring_transaction_templates", sub.recurring_template_id, {
        is_active: false,
        updated_at: now,
      }, now);
      // Local-only mirror of the remote trigger's cascade.
      await db.runAsync(
        `UPDATE subscriptions SET status = 'cancelled', updated_at = ? WHERE id = ?`,
        [now, id]
      );
    } else {
      await db.runAsync(
        `UPDATE subscriptions SET status = 'cancelled', updated_at = ? WHERE id = ?`,
        [now, id]
      );
      await enqueueUpdate(db, "subscriptions", id, {
        status: "cancelled",
        updated_at: now,
      }, now);
    }
  });
}
