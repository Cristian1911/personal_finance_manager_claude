"use server";

import { cacheTag, cacheLife } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { isDebtAccountType } from "@/lib/utils/account-balance";
import { startOfYear } from "date-fns";
import type { ActionResult } from "@/types/actions";

export interface TemplateStats {
  ytdTotal: number;
  annualEstimate: number;
  streak: number;
  isConsistent: boolean;
  impactPercent: number | null;
  marginAfter: number | null;
}

const FREQUENCY_MULTIPLIER: Record<string, number> = {
  WEEKLY: 52,
  BIWEEKLY: 24, // quincenal anclada al mes: 2 por mes
  MONTHLY: 12,
  QUARTERLY: 4,
  ANNUAL: 1,
  ONCE: 1,
};

async function getTemplateStatsCached(
  userId: string,
  templateId: string,
  accessToken: string
): Promise<TemplateStats> {
  "use cache";
  cacheTag("recurring", "occurrences");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  const { data: template } = await supabase
    .from("recurring_transaction_templates")
    .select("id, amount, frequency, direction, account_id")
    .eq("id", templateId)
    .eq("user_id", userId)
    .single();

  if (!template) {
    return { ytdTotal: 0, annualEstimate: 0, streak: 0, isConsistent: false, impactPercent: null, marginAfter: null };
  }

  // Paid occurrences this year
  const yearStart = startOfYear(new Date()).toISOString().split("T")[0];
  const { data: paidOccurrences } = await supabase
    .from("recurring_occurrences")
    .select("occurrence_date, expected_amount, paid_at")
    .eq("template_id", templateId)
    .eq("user_id", userId)
    .eq("status", "paid")
    .gte("occurrence_date", yearStart)
    .order("occurrence_date", { ascending: false });

  const paid = paidOccurrences ?? [];
  const ytdTotal = paid.reduce(
    (sum, o) => sum + Number(o.expected_amount),
    0
  );

  const multiplier = FREQUENCY_MULTIPLIER[template.frequency] ?? 12;
  const annualEstimate =
    template.frequency === "ONCE"
      ? Number(template.amount)
      : Number(template.amount) * multiplier;

  // Streak: consecutive periods with a payment (count backwards)
  let streak = 0;
  if (paid.length > 0) {
    streak = 1;
    for (let i = 1; i < paid.length; i++) {
      const prev = new Date(paid[i - 1].occurrence_date + "T12:00:00");
      const curr = new Date(paid[i].occurrence_date + "T12:00:00");
      const monthDiff =
        (prev.getFullYear() - curr.getFullYear()) * 12 +
        prev.getMonth() -
        curr.getMonth();
      if (monthDiff <= 2) {
        streak++;
      } else {
        break;
      }
    }
  }

  // Consistency: all paid amounts within 5% of template amount
  const templateAmount = Number(template.amount);
  const isConsistent =
    paid.length >= 2 &&
    paid.every(
      (o) =>
        Math.abs(Number(o.expected_amount) - templateAmount) / templateAmount <
        0.05
    );

  // Impact (ONCE only)
  let impactPercent: number | null = null;
  let marginAfter: number | null = null;

  if (template.frequency === "ONCE") {
    const { data: incomeTemplates } = await supabase
      .from("recurring_transaction_templates")
      .select("amount, frequency, account:accounts!recurring_transaction_templates_account_id_fkey(account_type)")
      .eq("user_id", userId)
      .eq("direction", "INFLOW")
      .eq("is_active", true);

    // Filter out debt payments (INFLOW to CREDIT_CARD/LOAN = payment, not income)
    const realIncome = (incomeTemplates ?? []).filter(
      (t) => !isDebtAccountType((t.account as { account_type: string } | null)?.account_type ?? "")
    );
    const monthlyIncome = realIncome.reduce((sum, t) => {
      const m = FREQUENCY_MULTIPLIER[t.frequency] ?? 12;
      return sum + (Number(t.amount) * m) / 12;
    }, 0);

    if (monthlyIncome > 0) {
      impactPercent = (Number(template.amount) / monthlyIncome) * 100;
    }

    const { data: expenseTemplates } = await supabase
      .from("recurring_transaction_templates")
      .select("amount, frequency")
      .eq("user_id", userId)
      .eq("direction", "OUTFLOW")
      .eq("is_active", true)
      .neq("id", templateId);

    const monthlyExpenses = (expenseTemplates ?? []).reduce((sum, t) => {
      const m = FREQUENCY_MULTIPLIER[t.frequency] ?? 12;
      return sum + (Number(t.amount) * m) / 12;
    }, 0);

    marginAfter = monthlyIncome - monthlyExpenses - Number(template.amount);
  }

  return {
    ytdTotal,
    annualEstimate,
    streak,
    isConsistent,
    impactPercent,
    marginAfter,
  };
}

export async function getTemplateStats(
  templateId: string
): Promise<ActionResult<TemplateStats>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  try {
    const data = await getTemplateStatsCached(user.id, templateId, accessToken);
    return { success: true, data };
  } catch {
    return { success: false, error: "Error al cargar estadísticas" };
  }
}
