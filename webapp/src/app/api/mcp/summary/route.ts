import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateCaptureToken } from "@/app/api/_shared/capture-auth";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

export async function GET(request: NextRequest) {
  const auth = await authenticateCaptureToken(request);
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();
  const currency = (request.nextUrl.searchParams.get("currency") ?? "COP") as CurrencyCode;

  const [{ data: accounts }, { data: recurring }] = await Promise.all([
    admin
      .from("accounts")
      .select("id, name, account_type, current_balance, currency_code, is_active, credit_limit, interest_rate")
      .eq("user_id", auth.userId)
      .eq("is_active", true),
    admin
      .from("recurring_transaction_templates")
      .select("id, merchant_name, description, amount, currency_code, day_of_month")
      .eq("user_id", auth.userId)
      .eq("is_active", true)
      .eq("currency_code", currency),
  ]);

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({
      total_balance: 0,
      available_to_spend: 0,
      pending_fixed: 0,
      accounts_count: 0,
      currency,
      message: "Sin cuentas activas.",
    });
  }

  const liquidTypes = new Set(["CHECKING", "SAVINGS", "CASH"]);
  const debtTypes = new Set(["CREDIT_CARD", "LOAN"]);

  let totalLiquid = 0;
  let totalDebt = 0;

  for (const acc of accounts) {
    if (acc.currency_code !== currency) continue;
    const balance = acc.current_balance ?? 0;
    if (liquidTypes.has(acc.account_type)) {
      totalLiquid += balance;
    } else if (debtTypes.has(acc.account_type)) {
      totalDebt += Math.abs(balance);
    }
  }

  const now = new Date();
  const currentDay = now.getDate();

  // Pending = recurring payments not yet paid this month (day_of_month >= today)
  const pendingThisMonth = (recurring ?? []).filter(
    (r) => r.day_of_month != null && r.day_of_month >= currentDay,
  );
  const totalPending = pendingThisMonth.reduce((sum, r) => sum + r.amount, 0);
  const availableToSpend = totalLiquid - totalPending;

  return NextResponse.json({
    total_balance: totalLiquid,
    total_balance_formatted: formatCurrency(totalLiquid, currency),
    total_debt: totalDebt,
    total_debt_formatted: formatCurrency(totalDebt, currency),
    pending_fixed: totalPending,
    pending_fixed_formatted: formatCurrency(totalPending, currency),
    available_to_spend: availableToSpend,
    available_to_spend_formatted: formatCurrency(availableToSpend, currency),
    pending_payments: pendingThisMonth.map((r) => ({
      name: r.merchant_name ?? r.description ?? "Pago recurrente",
      amount: r.amount,
      day_of_month: r.day_of_month,
    })),
    accounts_count: accounts.length,
    currency,
  });
}
