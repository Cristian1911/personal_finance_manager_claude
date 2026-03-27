"use server";

import { cacheTag, cacheLife } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { toISODateString } from "@/lib/utils/date";

export interface UpcomingPayment {
    id: string; // snapshot id
    account_id: string;
    account_name: string;
    account_type: string;
    currency_code: string;
    payment_due_date: string;
    total_payment_due: number;
}

// ─── Cached inner function ────────────────────────────────────────────────────

async function getUpcomingPaymentsCached(
  userId: string
): Promise<UpcomingPayment[]> {
  "use cache";
  cacheTag("snapshots");
  cacheLife("zeta");

  const today = toISODateString(new Date());
  const supabase = createAdminClient();

  // We want to fetch the LATEST snapshot for each account
  // But doing a group-by or distinct-on is tricky in Supabase clients without a view
  // Let's just grab all recent snapshots with a due date >= today
  // And filter in memory to essentially keep the most recently created one per account
  const { data: snapshots, error } = await supabase
    .from("statement_snapshots")
    .select(`
      id,
      account_id,
      payment_due_date,
      total_payment_due,
      currency_code,
      created_at,
      accounts!inner (
        name,
        account_type,
        is_active
      )
    `)
    .eq("user_id", userId)
    .eq("accounts.is_active", true)
    .not("payment_due_date", "is", null)
    .gte("payment_due_date", today)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!snapshots) return [];

  const uniqueByAccount = new Map<string, UpcomingPayment>();

  for (const s of snapshots) {
    // accounts is an object because of the foreign key !inner join
    const account = Array.isArray(s.accounts) ? s.accounts[0] : s.accounts;
    if (!account) continue;

    if (!uniqueByAccount.has(s.account_id)) {
      uniqueByAccount.set(s.account_id, {
        id: s.id,
        account_id: s.account_id,
        account_name: account.name,
        account_type: account.account_type,
        currency_code: s.currency_code,
        payment_due_date: s.payment_due_date!,
        total_payment_due: s.total_payment_due || 0,
      });
    }
  }

  // Convert to array and sort by payment_due_date ascending
  return Array.from(uniqueByAccount.values())
    .sort((a, b) => new Date(a.payment_due_date).getTime() - new Date(b.payment_due_date).getTime());
}

// ─── Public wrapper ───────────────────────────────────────────────────────────

export async function getUpcomingPayments(): Promise<UpcomingPayment[]> {
  const { user } = await getAuthenticatedClient();
  if (!user) return [];

  try {
    return await getUpcomingPaymentsCached(user.id);
  } catch {
    return [];
  }
}
