import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateCaptureToken } from "@/app/api/_shared/capture-auth";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

export async function GET(request: NextRequest) {
  const auth = await authenticateCaptureToken(request);
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(params.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(params.get("page_size") ?? "20")));
  const accountId = params.get("account_id");
  const categoryId = params.get("category_id");
  const direction = params.get("direction") as "INFLOW" | "OUTFLOW" | null;
  const dateFrom = params.get("date_from");
  const dateTo = params.get("date_to");
  const search = params.get("search");

  const admin = createAdminClient();

  let query = admin
    .from("transactions")
    .select(
      "id, amount, currency_code, direction, transaction_date, merchant_name, raw_description, clean_description, category_id, account_id, is_subscription, notes, categories!category_id(name_es, name)",
      { count: "exact" },
    )
    .eq("user_id", auth.userId)
    .eq("is_excluded", false)
    .is("reconciled_into_transaction_id", null)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (accountId) query = query.eq("account_id", accountId);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (direction) query = query.eq("direction", direction);
  if (dateFrom) query = query.gte("transaction_date", dateFrom);
  if (dateTo) query = query.lte("transaction_date", dateTo);
  if (search) query = query.or(
    `merchant_name.ilike.%${search}%,raw_description.ilike.%${search}%,clean_description.ilike.%${search}%`,
  );

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    transactions: (data ?? []).map((tx) => {
      const cat = tx.categories as { name_es: string | null; name: string } | null;
      return {
        id: tx.id,
        amount: tx.amount,
        amount_formatted: formatCurrency(tx.amount, tx.currency_code as CurrencyCode),
        currency: tx.currency_code,
        direction: tx.direction,
        date: tx.transaction_date,
        description: tx.merchant_name ?? tx.clean_description ?? tx.raw_description,
        category: cat?.name_es ?? cat?.name ?? null,
        account_id: tx.account_id,
        is_subscription: tx.is_subscription,
        notes: tx.notes,
      };
    }),
    total: count ?? 0,
    page,
    page_size: pageSize,
  });
}
