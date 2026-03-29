import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateCaptureToken } from "@/app/api/_shared/capture-auth";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

export async function GET(request: NextRequest) {
  const auth = await authenticateCaptureToken(request);
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const currency = (params.get("currency") ?? "COP") as CurrencyCode;
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const admin = createAdminClient();

  const [{ data: budgets }, { data: spending }] = await Promise.all([
    admin
      .from("budgets")
      .select("id, category_id, amount, categories!category_id(name_es, name, color, direction)")
      .eq("user_id", auth.userId),
    admin
      .from("transactions")
      .select("category_id, amount, direction")
      .eq("user_id", auth.userId)
      .eq("is_excluded", false)
      .eq("currency_code", currency)
      .gte("transaction_date", monthStart)
      .lte("transaction_date", monthEnd)
      .is("reconciled_into_transaction_id", null),
  ]);

  if (!budgets || budgets.length === 0) {
    return NextResponse.json({
      budgets: [],
      total_budgeted: 0,
      total_spent: 0,
      message: "Sin presupuestos configurados.",
    });
  }

  const spendingByCategory = new Map<string, number>();
  for (const tx of spending ?? []) {
    if (!tx.category_id) continue;
    const current = spendingByCategory.get(tx.category_id) ?? 0;
    spendingByCategory.set(tx.category_id, current + tx.amount);
  }

  const budgetItems = budgets.map((b) => {
    const cat = b.categories as { name_es: string | null; name: string; color: string | null; direction: string | null } | null;
    const spent = spendingByCategory.get(b.category_id ?? "") ?? 0;
    const limit = b.amount;
    const remaining = limit - spent;
    const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;

    return {
      category: cat?.name_es ?? cat?.name ?? "Sin categoría",
      budgeted: limit,
      budgeted_formatted: formatCurrency(limit, currency),
      spent,
      spent_formatted: formatCurrency(spent, currency),
      remaining,
      remaining_formatted: formatCurrency(remaining, currency),
      percent_used: percent,
      status: percent >= 100 ? "exceeded" : percent >= 80 ? "warning" : "ok",
    };
  });

  const totalBudgeted = budgetItems.reduce((sum, b) => sum + b.budgeted, 0);
  const totalSpent = budgetItems.reduce((sum, b) => sum + b.spent, 0);

  return NextResponse.json({
    budgets: budgetItems,
    total_budgeted: totalBudgeted,
    total_budgeted_formatted: formatCurrency(totalBudgeted, currency),
    total_spent: totalSpent,
    total_spent_formatted: formatCurrency(totalSpent, currency),
    month: monthStart.slice(0, 7),
    currency,
  });
}
