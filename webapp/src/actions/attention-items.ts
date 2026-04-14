"use server";

import "server-only";
import { cacheTag, cacheLife } from "next/cache";
import { addDays } from "date-fns";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { toColombiaDateString } from "@/lib/utils/date";
import { getPendingOccurrencesCached } from "@/actions/occurrences";


// ─── Types ───────────────────────────────────────────────────────────────────

export interface AttentionOverdueReminder {
  id: string;
  title: string;
  amount: number | null;
  currency_code: string;
  due_date: string;
}

export interface AttentionUpcomingPayment {
  templateId: string;
  name: string;
  amount: number;
  next_date: string;
  direction: "INFLOW" | "OUTFLOW";
  occurrenceDate: string;
}

export interface AttentionPendingEmail {
  id: string;
  merchant: string;
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  date: string;
  card_last4: string | null;
  suggested_account_id: string | null;
}

export interface AttentionItems {
  overdueReminders: AttentionOverdueReminder[];
  upcomingPayments: AttentionUpcomingPayment[];
  pendingEmails: AttentionPendingEmail[];
}

// ─── Empty fallback ──────────────────────────────────────────────────────────

const EMPTY: AttentionItems = {
  overdueReminders: [],
  upcomingPayments: [],
  pendingEmails: [],
};

// ─── Cached inner function ───────────────────────────────────────────────────

async function getAttentionItemsCached(
  userId: string,
  accessToken: string
): Promise<AttentionItems> {
  "use cache";
  cacheTag("attention");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const today = new Date();
  const todayStr = toColombiaDateString(today);
  const in7DaysStr = toColombiaDateString(addDays(today, 7));

  const [remindersRes, emailsRes, pendingOccurrences] = await Promise.all([
    // 1. Overdue reminders
    supabase
      .from("financial_reminders")
      .select("id, title, amount, currency_code, due_date")
      .eq("user_id", userId)
      .eq("is_completed", false)
      .lt("due_date", todayStr)
      .order("due_date", { ascending: true })
      .limit(5),

    // 2. Pending email transactions
    supabase
      .from("pending_email_transactions")
      .select("id, parsed_data, suggested_account_id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5),

    // 3. Pending recurring occurrences (next 7 days) — shared cached source
    getPendingOccurrencesCached(userId, todayStr, in7DaysStr, accessToken),
  ]);

  // ── Map overdue reminders ──────────────────────────────────────────────────

  const overdueReminders: AttentionOverdueReminder[] = (
    remindersRes.data ?? []
  ).map((r) => ({
    id: r.id,
    title: r.title,
    amount: r.amount,
    currency_code: r.currency_code ?? "COP",
    due_date: r.due_date!,
  }));

  // ── Map pending emails ─────────────────────────────────────────────────────

  const pendingEmails: AttentionPendingEmail[] = (emailsRes.data ?? []).map(
    (e) => {
      const parsed = e.parsed_data as Record<string, unknown> | null;
      return {
        id: e.id,
        merchant: (parsed?.merchant as string) || (parsed?.destination as string) || "Desconocido",
        amount: (parsed?.amount as number) ?? 0,
        direction:
          (parsed?.direction as "INFLOW" | "OUTFLOW") ?? "OUTFLOW",
        date: (parsed?.transaction_date as string) ?? "",
        card_last4: (parsed?.card_last4 as string) ?? null,
        suggested_account_id: e.suggested_account_id,
      };
    }
  );

  // ── Map upcoming payments from shared cached occurrences ──────────────────

  const upcomingPayments: AttentionUpcomingPayment[] = pendingOccurrences
    .slice(0, 5)
    .map((o) => ({
      templateId: o.template_id,
      name: o.merchant_name ?? o.description ?? "Pago recurrente",
      amount: o.expected_amount,
      next_date: o.occurrence_date,
      direction: o.direction,
      occurrenceDate: o.occurrence_date,
    }));

  return { overdueReminders, upcomingPayments, pendingEmails };
}

// ─── Public wrapper ──────────────────────────────────────────────────────────

export async function getAttentionItems(): Promise<AttentionItems> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return EMPTY;

  try {
    return await getAttentionItemsCached(user.id, accessToken);
  } catch (err) {
    console.error("Error fetching attention items:", err);
    return EMPTY;
  }
}
