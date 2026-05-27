import { getDatabase } from "../db/database";

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
 * Returns active subscriptions (excludes dismissed and cancelled),
 * joined with destinatario name and recurring template details.
 * Read-only — mobile produces no subscription mutations.
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
