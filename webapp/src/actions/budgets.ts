"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { budgetSchema } from "@/lib/validators/budget";
import { executeVisibleTransactionQuery } from "@/lib/utils/transactions";
import type { ActionResult } from "@/types/actions";
import type { Budget } from "@/types/domain";

type BudgetSummaryTransactionRow = {
    amount: number;
};

export async function getBudgets(): Promise<ActionResult<Budget[]>> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("budgets")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data ?? [] };
}

export async function upsertBudget(
    _prevState: ActionResult<Budget>,
    formData: FormData
): Promise<ActionResult<Budget>> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

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

    revalidatePath("/categories");
    revalidatePath("/dashboard");
    return { success: true, data };
}

export async function deleteBudget(id: string): Promise<ActionResult> {
    const supabase = await createClient();

    const { error } = await supabase.from("budgets").delete().eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/categories");
    revalidatePath("/dashboard");
    return { success: true, data: undefined };
}

export interface BudgetSummary {
    totalTarget: number;
    totalSpent: number;
    progress: number;
}

export async function getBudgetSummary(month?: string): Promise<BudgetSummary> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { totalTarget: 0, totalSpent: 0, progress: 0 };

    const { data: budgets } = await supabase.from("budgets").select("amount, category_id");
    if (!budgets || budgets.length === 0) return { totalTarget: 0, totalSpent: 0, progress: 0 };

    const totalTarget = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
    const budgetedCategoryIds = budgets.map((b) => b.category_id);

    const { monthStartStr, monthEndStr, parseMonth } = await import("@/lib/utils/date");
    const target = parseMonth(month);

    const { data: transactions } = await executeVisibleTransactionQuery(() =>
        supabase
            .from("transactions")
            .select("amount")
            .eq("direction", "OUTFLOW")
            .eq("is_excluded", false)
            .in("category_id", budgetedCategoryIds)
            .gte("transaction_date", monthStartStr(target))
            .lte("transaction_date", monthEndStr(target))
    );

    const totalSpent = (transactions as BudgetSummaryTransactionRow[] | null)?.reduce(
        (sum: number, tx: BudgetSummaryTransactionRow) => sum + Number(tx.amount),
        0
    ) ?? 0;
    const progress = totalTarget > 0 ? (totalSpent / totalTarget) * 100 : 0;

    return { totalTarget, totalSpent, progress };
}
