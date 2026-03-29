import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateCaptureToken } from "@/app/api/_shared/capture-auth";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

export async function GET(request: NextRequest) {
  const auth = await authenticateCaptureToken(request);
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const admin = createAdminClient();

  const { data: accounts, error } = await admin
    .from("accounts")
    .select(
      "id, name, account_type, institution_name, current_balance, available_balance, currency_code, credit_limit, interest_rate, is_active, mask, updated_at",
    )
    .eq("user_id", auth.userId)
    .eq("is_active", true)
    .order("display_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    accounts: (accounts ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      type: a.account_type,
      institution: a.institution_name,
      balance: a.current_balance ?? 0,
      balance_formatted: formatCurrency(a.current_balance ?? 0, a.currency_code as CurrencyCode),
      available: a.available_balance,
      currency: a.currency_code,
      credit_limit: a.credit_limit,
      interest_rate: a.interest_rate,
      mask: a.mask,
      last_updated: a.updated_at,
    })),
  });
}
