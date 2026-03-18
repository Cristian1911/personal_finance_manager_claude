"use server";

import { cacheTag, cacheLife, revalidateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { budgetSchema } from "@/lib/validators/budget";
import { executeVisibleTransactionQuery } from "@/lib/utils/transactions";
import type { ActionResult } from "@/types/actions";
import type { Budget } from "@/types/domain";

type BudgetSummaryTransactionRow = {
    amount: number;
};

// ─── Cached inner functions ───────────────────────────────────────────────────

async function getBudgetsCached(userId: string): Promise<Budget[]> {
    "use cache";
    cacheTag("budgets");
    cacheLife("zeta");

    const supabase = createAdminClient()!;
    const { data, error } = await supabase
        .from("budgets")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
}

async function getBudgetSummaryCached(userId: string, month?: string): Promise<BudgetSummary> {
    "use cache";
    cacheTag("budgets");
    cacheLife("zeta");

    const supabase = createAdminClient()!;

    const { data: budgets } = await supabase
        .from("budgets")
        .select("amount, category_id")
        .eq("user_id", userId);

    if (!budgets || budgets.length === 0) return { totalTarget: 0, totalSpent: 0, progress: 0 };

    const totalTarget = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
    const budgetedCategoryIds = budgets.map((b) => b.category_id);

    const { monthStartStr, monthEndStr, parseMonth } = await import("@/lib/utils/date");
    const target = parseMonth(month);

    const { data: transactions } = await executeVisibleTransactionQuery(() =>
        supabase
            .from("transactions")
            .select("amount")
            .eq("user_id", userId)
            .eq("direction", "OUTFLOW")
            .eq("is_excluded", false)
            .in("category_id", budgetedCategoryIds)
            .gte("transaction_date", monthStartStr(target))
            .lte("transaction_date", monthEndStr(target))
    );

    const totalSpent =
        (transactions as BudgetSummaryTransactionRow[] | null)?.reduce(
            (sum: number, tx: BudgetSummaryTransactionRow) => sum + Number(tx.amount),
            0
        ) ?? 0;
    const progress = totalTarget > 0 ? (totalSpent / totalTarget) * 100 : 0;

    return { totalTarget, totalSpent, progress };
}

// ─── Public wrappers ──────────────────────────────────────────────────────────

export async function getBudgets(): Promise<ActionResult<Budget[]>> {
    const { user } = await getAuthenticatedClient();
    if (!user) return { success: false, error: "No autenticado" };
    try {
        const data = await getBudgetsCached(user.id);
        return { success: true, data };
    } catch {
        return { success: false, error: "Error al cargar los presupuestos" };
    }
}

export interface BudgetSummary {
    totalTarget: number;
    totalSpent: number;
    progress: number;
}

export async function getBudgetSummary(month?: string): Promise<BudgetSummary> {
    const { user } = await getAuthenticatedClient();
    if (!user) return { totalTarget: 0, totalSpent: 0, progress: 0 };
    return getBudgetSummaryCached(user.id, month);
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function upsertBudget(
    _prevState: ActionResult<Budget>,
    formData: FormData
): Promise<ActionResult<Budget>> {
    const { supabase, user } = await getAuthenticatedClient();

    if (!user) return { success: false, error: "No autenticado" };

    const parsed = budgetSchema.safeParse({
        category_id: formData.get("category_id"),
        amount: Number(formData.get("amount")),
        period: formData.get("period") || "monthly",
    });

    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message };
    }

    const { data, error } = await supabase
        .from("budgets")
        .upsert(
            {
                user_id: user.id,
                ...parsed.data,
                updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id, category_id, period" }
        )
        .select()
        .single();

    if (error) return { success: false, error: error.message };

    revalidateTag("budgets", "zeta");
    revalidateTag("dashboard", "zeta");
    return { success: true, data };
}

export async function deleteBudget(id: string): Promise<ActionResult> {
    const { supabase, user } = await getAuthenticatedClient();

    if (!user) return { success: false, error: "No autenticado" };

    const { error } = await supabase.from("budgets").delete().eq("user_id", user.id).eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidateTag("budgets", "zeta");
    revalidateTag("dashboard", "zeta");
    return { success: true, data: undefined };
}
