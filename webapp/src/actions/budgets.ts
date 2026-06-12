"use server";

import { cacheTag, cacheLife, updateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIsDemoFilter, getDemoAccountIds } from "@/lib/demo-filter";
import { budgetSchema } from "@/lib/validators/budget";
import { UUID_RE } from "@/lib/validators/shared";
import type { ActionResult } from "@/types/actions";
import type { Budget } from "@/types/domain";

type BudgetSummaryTransactionRow = {
    amount: number;
};

// ─── Cached inner functions ───────────────────────────────────────────────────

async function getBudgetSummaryCached(userId: string, month: string | undefined, isDemo: boolean): Promise<BudgetSummary> {
    "use cache";
    cacheTag("budgets");
    cacheLife("zeta");

    const supabase = createAdminClient();

    const { data: budgets } = await supabase
        .from("budgets")
        .select("amount, category_id, category:categories(parent_id)")
        .eq("user_id", userId)
        .eq("is_demo", isDemo);

    if (!budgets || budgets.length === 0) return { totalTarget: 0, totalSpent: 0, progress: 0 };

    const totalTarget = budgets.reduce((sum, b) => sum + Number(b.amount), 0);
    // Include parents of budgeted subcategories so spending categorized directly
    // at the parent still counts when a group is composed without a Base row.
    const budgetedCategoryIds = [
        ...new Set(
            budgets.flatMap((b) => {
                const parentId = (b.category as { parent_id: string | null } | null)?.parent_id;
                return parentId ? [b.category_id, parentId] : [b.category_id];
            })
        ),
    ];

    const { monthStartStr, monthEndStr, parseMonth } = await import("@/lib/utils/date");
    const target = parseMonth(month);

    const accountIds = await getDemoAccountIds(supabase, userId, isDemo);
    if (!accountIds) return { totalTarget, totalSpent: 0, progress: 0 };

    const { data: transactions } = await supabase
        .from("transactions")
        .select("amount")
        .eq("user_id", userId)
        .in("account_id", accountIds)
        .eq("direction", "OUTFLOW")
        .eq("is_excluded", false)
        .in("category_id", budgetedCategoryIds)
        .gte("transaction_date", monthStartStr(target))
        .lte("transaction_date", monthEndStr(target))
        .is("reconciled_into_transaction_id", null);

    const totalSpent =
        (transactions as BudgetSummaryTransactionRow[] | null)?.reduce(
            (sum: number, tx: BudgetSummaryTransactionRow) => sum + Number(tx.amount),
            0
        ) ?? 0;
    const progress = totalTarget > 0 ? (totalSpent / totalTarget) * 100 : 0;

    return { totalTarget, totalSpent, progress };
}

// ─── Public wrappers ──────────────────────────────────────────────────────────

export interface BudgetSummary {
    totalTarget: number;
    totalSpent: number;
    progress: number;
}

export async function getBudgetSummary(month?: string): Promise<BudgetSummary> {
    const { user } = await getAuthenticatedClient();
    if (!user) return { totalTarget: 0, totalSpent: 0, progress: 0 };
    const isDemo = await getIsDemoFilter(user.id);
    return getBudgetSummaryCached(user.id, month, isDemo);
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
            { onConflict: "user_id,category_id,period" }
        )
        .select()
        .single();

    if (error) return { success: false, error: error.message };

    updateTag("budgets");
    updateTag("dashboard:budgets");
    updateTag("attention");
    return { success: true, data };
}

export async function deleteBudget(id: string): Promise<ActionResult> {
    const { supabase, user } = await getAuthenticatedClient();

    if (!user) return { success: false, error: "No autenticado" };

    const { error } = await supabase.from("budgets").delete().eq("user_id", user.id).eq("id", id);

    if (error) return { success: false, error: error.message };

    updateTag("budgets");
    updateTag("dashboard:budgets");
    updateTag("attention");
    return { success: true, data: undefined };
}

export interface BudgetCompositionInput {
    upserts: { category_id: string; amount: number }[];
    deletes: string[];
}

/**
 * Persists a builder/composer diff: batch-upserts changed lines (incl. the
 * parent's "Base" row) and batch-deletes cleared ones. Sequential, not
 * transactional — same atomicity level as applyBudgetScenario; the client
 * keeps its draft on failure.
 */
export async function applyBudgetComposition(
    input: BudgetCompositionInput
): Promise<ActionResult<null>> {
    const { supabase, user } = await getAuthenticatedClient();
    if (!user) return { success: false, error: "No autenticado" };

    const ids = [...input.upserts.map((u) => u.category_id), ...input.deletes];
    if (ids.some((id) => !UUID_RE.test(id))) {
        return { success: false, error: "Categoría inválida" };
    }
    if (input.upserts.some((u) => !Number.isFinite(u.amount) || u.amount <= 0)) {
        return { success: false, error: "Monto inválido" };
    }
    if (ids.length === 0) return { success: true, data: null };

    // Mirror applyBudgetScenario: demo-mode rows must be written/deleted with
    // the demo flag or they become invisible to the demo-filtered summary.
    const isDemo = await getIsDemoFilter(user.id);

    if (input.upserts.length > 0) {
        const rows = input.upserts.map((u) => ({
            user_id: user.id,
            category_id: u.category_id,
            amount: u.amount,
            period: "monthly" as const,
            is_demo: isDemo,
            updated_at: new Date().toISOString(),
        }));
        const { error } = await supabase
            .from("budgets")
            .upsert(rows, { onConflict: "user_id,category_id,period" });
        if (error) return { success: false, error: error.message };
    }

    if (input.deletes.length > 0) {
        const { error } = await supabase
            .from("budgets")
            .delete()
            .eq("user_id", user.id)
            .eq("period", "monthly")
            .eq("is_demo", isDemo)
            .in("category_id", input.deletes);
        if (error) return { success: false, error: error.message };
    }

    updateTag("budgets");
    updateTag("dashboard:budgets");
    updateTag("attention");
    return { success: true, data: null };
}

export async function deleteBudgetForCategory(categoryId: string): Promise<ActionResult> {
    const { supabase, user } = await getAuthenticatedClient();

    if (!user) return { success: false, error: "No autenticado" };
    if (!UUID_RE.test(categoryId)) return { success: false, error: "Categoría inválida" };

    // Scope by is_demo like applyBudgetComposition/applyBudgetScenario so demo
    // and real rows stay isolated.
    const isDemo = await getIsDemoFilter(user.id);

    const { error } = await supabase
        .from("budgets")
        .delete()
        .eq("user_id", user.id)
        .eq("category_id", categoryId)
        .eq("period", "monthly")
        .eq("is_demo", isDemo);

    if (error) return { success: false, error: error.message };

    updateTag("budgets");
    updateTag("dashboard:budgets");
    updateTag("attention");
    return { success: true, data: undefined };
}
