import { createClient } from "@/lib/supabase/server";

export interface UpcomingPayment {
    id: string; // snapshot id
    account_id: string;
    account_name: string;
    account_type: string;
    currency_code: string;
    payment_due_date: string;
    total_payment_due: number;
}

export async function getUpcomingPayments(): Promise<UpcomingPayment[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return [];

    // Get today's date in YYYY-MM-DD format based on local timezone? 
    // For simplicity, ISO string's date part works generally well enough, or just query `>= today`
    const today = new Date().toISOString().split("T")[0];

    // We want to fetch the LATEST snapshot for each account
    // But doing a group-by or distinct-on is tricky in Supabase clients without a view
    // Let's just grab all recent snapshots with a due date >= today
    // And filter in memory to essentially keep the most recently created one per account
    const { data: snapshots } = await supabase
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
        .eq("accounts.is_active", true)
        .not("payment_due_date", "is", null)
        .gte("payment_due_date", today)
        .order("created_at", { ascending: false });

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
