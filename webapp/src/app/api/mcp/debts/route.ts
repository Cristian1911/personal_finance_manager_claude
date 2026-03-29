import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateCaptureToken } from "@/app/api/_shared/capture-auth";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

export async function GET(request: NextRequest) {
  const auth = await authenticateCaptureToken(request);
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const currency = (request.nextUrl.searchParams.get("currency") ?? "COP") as CurrencyCode;
  const admin = createAdminClient();

  const { data: accounts } = await admin
    .from("accounts")
    .select(
      "id, name, account_type, current_balance, currency_code, credit_limit, interest_rate, monthly_payment, loan_amount, loan_start_date, loan_end_date",
    )
    .eq("user_id", auth.userId)
    .eq("is_active", true)
    .in("account_type", ["CREDIT_CARD", "LOAN"]);

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({
      debts: [],
      total_debt: 0,
      message: "Sin deudas registradas.",
    });
  }

  const debts = accounts
    .filter((a) => a.currency_code === currency)
    .map((a) => {
      const balance = Math.abs(a.current_balance ?? 0);
      const limit = a.credit_limit ?? 0;
      const utilization = limit > 0 ? Math.round((balance / limit) * 100) : null;

      return {
        id: a.id,
        name: a.name,
        type: a.account_type,
        balance,
        balance_formatted: formatCurrency(balance, currency),
        credit_limit: limit || null,
        utilization_percent: utilization,
        interest_rate: a.interest_rate,
        monthly_payment: a.monthly_payment,
        monthly_payment_formatted: a.monthly_payment
          ? formatCurrency(a.monthly_payment, currency)
          : null,
        loan_start: a.loan_start_date,
        loan_end: a.loan_end_date,
      };
    });

  const totalDebt = debts.reduce((sum, d) => sum + d.balance, 0);

  return NextResponse.json({
    debts,
    total_debt: totalDebt,
    total_debt_formatted: formatCurrency(totalDebt, currency),
    currency,
  });
}
