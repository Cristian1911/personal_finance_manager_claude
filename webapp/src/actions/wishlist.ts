"use server";

import { revalidateTag } from "next/cache";
import {
  analyzePurchaseDecision,
  calcUtilization,
  computeDebtBalance,
  estimateMonthlyInterest,
  extractDebtAccounts,
  type PurchaseDecisionResult,
  type PurchaseFundingType,
  type PurchaseUrgency,
} from "@zeta/shared";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import {
  createWishlistItemSchema,
  enrichWishlistItemSchema,
  reflectionSchema,
} from "@/lib/validators/wishlist";
import { monthEndStr, monthStartStr, parseMonth } from "@/lib/utils/date";
import { getUpcomingRecurrences } from "@/actions/recurring-templates";
import type { ActionResult } from "@/types/actions";
import type { Account, WishlistItem, WishlistReflection } from "@/types/domain";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type TxRow = {
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  account_id: string;
};

type BudgetTxRow = {
  amount: number;
};

const ACCOUNT_TYPE_MAP: Record<
  string,
  "CHECKING" | "SAVINGS" | "CASH" | "INVESTMENT" | "CREDIT_CARD" | "OTHER"
> = {
  CHECKING: "CHECKING",
  SAVINGS: "SAVINGS",
  CASH: "CASH",
  INVESTMENT: "INVESTMENT",
  CREDIT_CARD: "CREDIT_CARD",
  LOAN: "OTHER",
  OTHER: "OTHER",
};

function getSelectedAccountAvailable(account: Account): number {
  if (account.account_type === "CREDIT_CARD") {
    if (account.available_balance != null) {
      return Math.max(account.available_balance, 0);
    }
    if (account.credit_limit != null) {
      return Math.max(account.credit_limit - computeDebtBalance(account), 0);
    }
    return 0;
  }
  return Math.max(account.current_balance, 0);
}

function getNearestDays(dates: string[]): number | null {
  if (dates.length === 0) return null;
  const now = new Date();
  const deltas = dates
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .map((date) =>
      Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    )
    .filter((days) => days >= 0);
  if (deltas.length === 0) return null;
  return Math.min(...deltas);
}

function invalidateWishlist() {
  revalidateTag("wishlist", "zeta");
}

// ─── Section 1: CRUD Queries & Mutations ─────────────────────────────────────

export async function getWishlistItems(): Promise<WishlistItem[]> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return [];

  const { data, error } = await supabase
    .from("wishlist_items")
    .select("*")
    .eq("user_id", user.id)
    .order("status", { ascending: true })
    .order("last_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching wishlist items:", error);
    return [];
  }

  return (data ?? []) as WishlistItem[];
}

export async function getWishlistItemsForDashboard(): Promise<{
  items: WishlistItem[];
  totalCount: number;
  readyCount: number;
}> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { items: [], totalCount: 0, readyCount: 0 };

  const { data, error } = await supabase
    .from("wishlist_items")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "wishlist")
    .order("last_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error fetching dashboard wishlist items:", error);
    return { items: [], totalCount: 0, readyCount: 0 };
  }

  const all = (data ?? []) as WishlistItem[];
  const readyCount = all.filter(
    (item) => item.last_score != null && item.last_score >= 55
  ).length;

  return {
    items: all.slice(0, 2),
    totalCount: all.length,
    readyCount,
  };
}

export async function createWishlistItem(
  formData: FormData
): Promise<ActionResult<WishlistItem>> {
  const raw = {
    name: formData.get("name"),
    amount: formData.get("amount"),
    currency_code: formData.get("currency_code") || "COP",
  };

  const parsed = createWishlistItemSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("wishlist_items")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      amount: parsed.data.amount,
      currency_code: parsed.data.currency_code,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Error creating wishlist item:", error);
    return { success: false, error: "Error al crear el deseo" };
  }

  invalidateWishlist();
  return { success: true, data: data as WishlistItem };
}

export async function enrichWishlistItem(
  rawInput: unknown
): Promise<ActionResult<WishlistItem>> {
  const parsed = enrichWishlistItemSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("wishlist_items")
    .update({
      why: parsed.data.why ?? null,
      urgency: parsed.data.urgency,
      desire_type: parsed.data.desire_type,
      category_id: parsed.data.category_id ?? null,
      funding_type: parsed.data.funding_type,
      installments: parsed.data.installments ?? null,
      account_id: parsed.data.account_id ?? null,
      enriched: true,
      enriched_at: now,
      updated_at: now,
    })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    console.error("Error enriching wishlist item:", error);
    return { success: false, error: "Error al enriquecer el deseo" };
  }

  invalidateWishlist();
  return { success: true, data: data as WishlistItem };
}

export async function deleteWishlistItem(
  id: string
): Promise<ActionResult<void>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("wishlist_items")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error deleting wishlist item:", error);
    return { success: false, error: "Error al eliminar el deseo" };
  }

  invalidateWishlist();
  return { success: true, data: undefined };
}

export async function markWishlistItemBought(
  id: string,
  transactionId?: string
): Promise<ActionResult<WishlistItem>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("wishlist_items")
    .update({
      status: "bought",
      bought_at: now,
      transaction_id: transactionId ?? null,
      updated_at: now,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    console.error("Error marking wishlist item as bought:", error);
    return { success: false, error: "Error al marcar como comprado" };
  }

  invalidateWishlist();
  return { success: true, data: data as WishlistItem };
}

// ─── Section 2: Scoring (Fail-Closed, Shared Snapshot) ──────────────────────

export type FinancialSnapshot = {
  accounts: Account[];
  liquidCashAvailable: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  upcomingCommittedPayments: number;
  daysToNearestPayment: number | null;
  debtUtilizationPct: number | null;
  monthlyDebtInterestCost: number;
  activeDebtAccounts: ReturnType<typeof extractDebtAccounts>;
};

/**
 * Fetches the shared financial context used by all item scorers.
 * Returns null if critical queries fail (fail-closed).
 */
export async function getFinancialSnapshot(): Promise<FinancialSnapshot | null> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return null;

  const targetMonth = parseMonth(null);

  const [accountsRes, monthTxRes, upcomingRecurrences] =
    await Promise.all([
      supabase
        .from("accounts")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("display_order"),
      supabase
        .from("transactions")
        .select("amount, direction, account_id")
        .eq("is_excluded", false)
        .gte("transaction_date", monthStartStr(targetMonth))
        .lte("transaction_date", monthEndStr(targetMonth))
        .is("reconciled_into_transaction_id", null),
      getUpcomingRecurrences(30),
    ]);

  // Fail-closed: if accounts or transactions query fails, return null
  if (accountsRes.error || monthTxRes.error) {
    console.error(
      "Financial snapshot failed:",
      accountsRes.error ?? monthTxRes.error
    );
    return null;
  }

  const accounts = (accountsRes.data ?? []) as Account[];
  const monthTransactions = (monthTxRes.data ?? []) as TxRow[];

  const debtAccounts = extractDebtAccounts(accounts);
  const debtAccountIds = new Set(debtAccounts.map((a) => a.id));

  const totalCreditLimit = debtAccounts
    .filter((a) => a.type === "CREDIT_CARD")
    .reduce((sum, a) => sum + (a.creditLimit ?? 0), 0);
  const totalCreditDebt = debtAccounts
    .filter((a) => a.type === "CREDIT_CARD")
    .reduce((sum, a) => sum + a.balance, 0);
  const monthlyDebtInterestCost = debtAccounts.reduce(
    (sum, a) => sum + estimateMonthlyInterest(a.balance, a.interestRate),
    0
  );

  const monthlyIncome = monthTransactions
    .filter((tx) => tx.direction === "INFLOW" && !debtAccountIds.has(tx.account_id))
    .reduce((sum, tx) => sum + tx.amount, 0);
  const monthlyExpenses = monthTransactions
    .filter((tx) => tx.direction === "OUTFLOW")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const liquidCashAvailable = accounts
    .filter(
      (a) => a.account_type !== "CREDIT_CARD" && a.account_type !== "LOAN"
    )
    .reduce((sum, a) => sum + Math.max(a.current_balance, 0), 0);

  const recurringCommitments = upcomingRecurrences
    .filter(
      (item) =>
        item.template.direction === "OUTFLOW" &&
        item.template.account.account_type !== "CREDIT_CARD" &&
        item.template.account.account_type !== "LOAN"
    )
    .reduce((sum, item) => sum + item.template.amount, 0);

  const upcomingCommittedPayments = recurringCommitments;

  const daysToNearestPayment = getNearestDays(
    upcomingRecurrences.map((item) => item.next_date)
  );

  const debtUtilizationPct =
    totalCreditLimit > 0
      ? calcUtilization(totalCreditDebt, totalCreditLimit)
      : null;

  return {
    accounts,
    liquidCashAvailable,
    monthlyIncome,
    monthlyExpenses,
    upcomingCommittedPayments,
    daysToNearestPayment,
    debtUtilizationPct,
    monthlyDebtInterestCost,
    activeDebtAccounts: debtAccounts.filter((a) => a.balance > 0),
  };
}

/**
 * Score a single wishlist item against a pre-fetched financial snapshot.
 * Returns null on failure (item is unenriched, missing account, etc.).
 * Persists score as best-effort side effect. Sets ready_at on first green transition.
 */
async function scoreItemWithSnapshot(
  item: WishlistItem,
  snapshot: FinancialSnapshot,
  supabase: Awaited<ReturnType<typeof getAuthenticatedClient>>["supabase"],
  userId: string
): Promise<PurchaseDecisionResult | null> {
  if (!item.enriched || !item.urgency || !item.funding_type) return null;

  const selectedAccount = item.account_id
    ? snapshot.accounts.find((a) => a.id === item.account_id)
    : snapshot.accounts.find(
        (a) => a.account_type !== "CREDIT_CARD" && a.account_type !== "LOAN"
      );

  if (!selectedAccount) return null;

  // Per-item: fetch category budget if category_id exists
  let budgetRemaining: number | null = null;
  if (item.category_id) {
    try {
      const targetMonth = parseMonth();
      const [budgetRes, spentRes] = await Promise.all([
        supabase
          .from("budgets")
          .select("amount")
          .eq("category_id", item.category_id)
          .eq("period", "monthly")
          .maybeSingle(),
        supabase
          .from("transactions")
          .select("amount")
          .eq("direction", "OUTFLOW")
          .eq("is_excluded", false)
          .eq("category_id", item.category_id)
          .gte("transaction_date", monthStartStr(targetMonth))
          .lte("transaction_date", monthEndStr(targetMonth))
          .is("reconciled_into_transaction_id", null),
      ]);

      const budgetTarget = budgetRes.data?.amount ?? null;
      if (budgetTarget != null) {
        const budgetSpent = ((spentRes.data ?? []) as BudgetTxRow[]).reduce(
          (sum, tx) => sum + tx.amount,
          0
        );
        budgetRemaining = Number(budgetTarget) - budgetSpent;
      }
    } catch {
      // Budget lookup failure is non-fatal
    }
  }

  const selectedDebtAfterPurchase =
    selectedAccount.account_type === "CREDIT_CARD"
      ? computeDebtBalance(selectedAccount)
      : null;

  const result = analyzePurchaseDecision({
    amount: item.amount,
    urgency: item.urgency as PurchaseUrgency,
    fundingType: item.funding_type as PurchaseFundingType,
    installments: item.installments ?? null,
    liquidCashAvailable: snapshot.liquidCashAvailable,
    selectedAccountAvailable: getSelectedAccountAvailable(selectedAccount),
    selectedAccountType:
      ACCOUNT_TYPE_MAP[selectedAccount.account_type] ?? "OTHER",
    selectedAccountCreditLimit: selectedAccount.credit_limit,
    selectedAccountCurrentDebt: selectedDebtAfterPurchase,
    monthlyIncome: snapshot.monthlyIncome,
    monthlyExpenses: snapshot.monthlyExpenses,
    upcomingCommittedPayments: snapshot.upcomingCommittedPayments,
    daysToNearestPayment: snapshot.daysToNearestPayment,
    budgetRemaining,
    debtUtilizationPct: snapshot.debtUtilizationPct,
    monthlyDebtInterestCost: snapshot.monthlyDebtInterestCost,
    activeDebtAccounts: snapshot.activeDebtAccounts,
  });

  // Best-effort: persist score
  try {
    const wasGreen =
      item.last_verdict === "BUY" || item.last_verdict === "BUY_WITH_CAUTION";
    const isGreen =
      result.verdict === "BUY" || result.verdict === "BUY_WITH_CAUTION";

    const updatePayload: Record<string, unknown> = {
      last_score: result.score,
      last_verdict: result.verdict,
      last_scored_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isGreen && !wasGreen && !item.ready_at) {
      updatePayload.ready_at = new Date().toISOString();
    }

    await supabase
      .from("wishlist_items")
      .update(updatePayload)
      .eq("id", item.id)
      .eq("user_id", userId);
  } catch {
    // Score persistence failure is non-fatal
  }

  return result;
}

export type ScoredWishlistItem = WishlistItem & {
  freshScore: number | null;
  freshVerdict: string | null;
  scoreError: boolean;
};

/**
 * Main query for the Deseos page.
 * Fetches all items, gets snapshot once, scores all enriched active items.
 */
export async function getWishlistItemsWithFreshScores(): Promise<
  ScoredWishlistItem[]
> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return [];

  const { data, error } = await supabase
    .from("wishlist_items")
    .select("*")
    .eq("user_id", user.id)
    .order("status", { ascending: true })
    .order("last_score", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching wishlist items:", error);
    return [];
  }

  const items = (data ?? []) as WishlistItem[];

  // Fetch snapshot once for all items
  const snapshot = await getFinancialSnapshot();

  const scored: ScoredWishlistItem[] = await Promise.all(
    items.map(async (item) => {
      // Only score enriched wishlist items
      if (item.status !== "wishlist" || !item.enriched || !snapshot) {
        return {
          ...item,
          freshScore: item.last_score,
          freshVerdict: item.last_verdict,
          scoreError: false,
        };
      }

      try {
        const result = await scoreItemWithSnapshot(item, snapshot, supabase, user.id);
        if (!result) {
          return {
            ...item,
            freshScore: item.last_score,
            freshVerdict: item.last_verdict,
            scoreError: false,
          };
        }
        return {
          ...item,
          freshScore: result.score,
          freshVerdict: result.verdict,
          // Update in-memory values too
          last_score: result.score,
          last_verdict: result.verdict,
          scoreError: false,
        };
      } catch {
        return {
          ...item,
          freshScore: item.last_score,
          freshVerdict: item.last_verdict,
          scoreError: true,
        };
      }
    })
  );

  return scored;
}

/**
 * Score a single item by ID (used after enrichment).
 */
export async function scoreWishlistItem(
  id: string
): Promise<ActionResult<{ score: number; verdict: string }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: item, error } = await supabase
    .from("wishlist_items")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !item) {
    return { success: false, error: "Deseo no encontrado" };
  }

  const wishlistItem = item as WishlistItem;
  if (!wishlistItem.enriched) {
    return {
      success: false,
      error: "El deseo debe ser enriquecido antes de puntuarlo",
    };
  }

  const snapshot = await getFinancialSnapshot();
  if (!snapshot) {
    return {
      success: false,
      error: "No se pudo obtener tu contexto financiero",
    };
  }

  const result = await scoreItemWithSnapshot(wishlistItem, snapshot, supabase, user.id);
  if (!result) {
    return { success: false, error: "No se pudo puntuar este deseo" };
  }

  invalidateWishlist();
  return {
    success: true,
    data: { score: result.score, verdict: result.verdict },
  };
}

// ─── Section 3: Reflections ──────────────────────────────────────────────────

export async function submitReflection(
  rawInput: unknown
): Promise<ActionResult<WishlistReflection>> {
  const parsed = reflectionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
    };
  }

  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // Verify item belongs to user and is in bought or reflected status
  const { data: item, error: itemError } = await supabase
    .from("wishlist_items")
    .select("id, status, bought_at")
    .eq("id", parsed.data.wishlist_item_id)
    .eq("user_id", user.id)
    .single();

  if (itemError || !item) {
    return { success: false, error: "Deseo no encontrado" };
  }

  if (item.status !== "bought" && item.status !== "reflected") {
    return {
      success: false,
      error: "Solo se puede reflexionar sobre compras realizadas",
    };
  }

  // Compute days since purchase
  const boughtAt = item.bought_at ? new Date(item.bought_at) : new Date();
  const daysSincePurchase = Math.max(
    0,
    Math.floor(
      (Date.now() - boughtAt.getTime()) / (1000 * 60 * 60 * 24)
    )
  );

  // Idempotent insert: 23505 = already reflected = success
  const { data: reflection, error: insertError } = await supabase
    .from("wishlist_reflections")
    .insert({
      wishlist_item_id: parsed.data.wishlist_item_id,
      user_id: user.id,
      reflection_stage: parsed.data.reflection_stage,
      worth_it: parsed.data.worth_it,
      rating: parsed.data.rating,
      note: parsed.data.note ?? null,
      days_since_purchase: daysSincePurchase,
    })
    .select("*")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      // Already reflected — treat as success, fetch existing
      const { data: existing } = await supabase
        .from("wishlist_reflections")
        .select("*")
        .eq("wishlist_item_id", parsed.data.wishlist_item_id)
        .eq("reflection_stage", parsed.data.reflection_stage)
        .eq("user_id", user.id)
        .single();

      if (existing) {
        return { success: true, data: existing as WishlistReflection };
      }
      return { success: false, error: "Ya existe una reflexión para esta etapa" };
    }
    console.error("Error inserting reflection:", insertError);
    return { success: false, error: "Error al guardar la reflexión" };
  }

  // Update item status to "reflected"
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("wishlist_items")
    .update({ status: "reflected", updated_at: now })
    .eq("id", parsed.data.wishlist_item_id)
    .eq("user_id", user.id);

  if (updateError) {
    console.error("Error updating item status to reflected:", updateError);
    // Non-fatal: reflection was saved
  }

  invalidateWishlist();
  return { success: true, data: reflection as WishlistReflection };
}

export async function getReflectionsForItem(
  itemId: string
): Promise<WishlistReflection[]> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return [];

  const { data, error } = await supabase
    .from("wishlist_reflections")
    .select("*")
    .eq("wishlist_item_id", itemId)
    .eq("user_id", user.id)
    .order("reflected_at", { ascending: true });

  if (error) {
    console.error("Error fetching reflections:", error);
    return [];
  }

  return (data ?? []) as WishlistReflection[];
}

// ─── Section 4: Insights ────────────────────────────────────────────────────

export type WishlistInsight = {
  type: "urgency_pattern" | "wait_time_pattern" | "worth_it_pattern";
  label: string;
  message: string;
};

type ReflectedItemWithReflections = WishlistItem & {
  wishlist_reflections: WishlistReflection[];
};

export async function getWishlistInsights(): Promise<WishlistInsight[]> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return [];

  const { data, error } = await supabase
    .from("wishlist_items")
    .select("*, wishlist_reflections(*)")
    .eq("user_id", user.id)
    .in("status", ["reflected", "archived"])
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Error fetching wishlist insights:", error);
    return [];
  }

  const items = (data ?? []) as ReflectedItemWithReflections[];

  // Need 5+ items for meaningful insights
  if (items.length < 5) return [];

  const insights: WishlistInsight[] = [];

  // Group by urgency
  const byUrgency: Record<string, ReflectedItemWithReflections[]> = {};
  for (const item of items) {
    if (item.urgency) {
      byUrgency[item.urgency] ??= [];
      byUrgency[item.urgency].push(item);
    }
  }

  for (const [urgency, group] of Object.entries(byUrgency)) {
    if (group.length < 3) continue;

    const reflections = group.flatMap((i) => i.wishlist_reflections);
    const worthItCount = reflections.filter((r) => r.worth_it).length;
    const total = reflections.length;

    if (total === 0) continue;

    const worthItPct = Math.round((worthItCount / total) * 100);
    const urgencyLabel =
      urgency === "NECESSARY"
        ? "necesarias"
        : urgency === "USEFUL"
          ? "útiles"
          : "impulsivas";

    if (urgency === "IMPULSE" && worthItPct < 40) {
      insights.push({
        type: "urgency_pattern",
        label: "Compras impulsivas",
        message: `Solo el ${worthItPct}% de tus compras impulsivas valieron la pena. Considerar esperar más antes de decidir.`,
      });
    } else if (worthItPct > 80) {
      insights.push({
        type: "urgency_pattern",
        label: `Compras ${urgencyLabel}`,
        message: `El ${worthItPct}% de tus compras ${urgencyLabel} valieron la pena. Buen criterio de selección.`,
      });
    }
  }

  // Group by wait time
  const shortWait: ReflectedItemWithReflections[] = []; // < 30 days from created to bought
  const longWait: ReflectedItemWithReflections[] = []; // >= 60 days

  for (const item of items) {
    if (!item.bought_at) continue;
    const created = new Date(item.created_at);
    const bought = new Date(item.bought_at);
    const waitDays = Math.floor(
      (bought.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (waitDays < 30) shortWait.push(item);
    else if (waitDays >= 60) longWait.push(item);
  }

  if (shortWait.length >= 3) {
    const shortReflections = shortWait.flatMap((i) => i.wishlist_reflections);
    const shortWorthIt = shortReflections.filter((r) => r.worth_it).length;
    const shortTotal = shortReflections.length;
    if (shortTotal > 0) {
      const pct = Math.round((shortWorthIt / shortTotal) * 100);
      insights.push({
        type: "wait_time_pattern",
        label: "Compras rápidas",
        message: `${pct}% de satisfacción en compras decididas en menos de 30 días (${shortWait.length} compras).`,
      });
    }
  }

  if (longWait.length >= 3) {
    const longReflections = longWait.flatMap((i) => i.wishlist_reflections);
    const longWorthIt = longReflections.filter((r) => r.worth_it).length;
    const longTotal = longReflections.length;
    if (longTotal > 0) {
      const pct = Math.round((longWorthIt / longTotal) * 100);
      insights.push({
        type: "wait_time_pattern",
        label: "Compras meditadas",
        message: `${pct}% de satisfacción en compras con 60+ días de espera (${longWait.length} compras).`,
      });
    }
  }

  return insights;
}

// ─── Section 5: Nudges ──────────────────────────────────────────────────────

export type WishlistNudge = {
  type: "desire_maturity" | "score_transition" | "budget_surplus" | "debt_milestone";
  itemId: string;
  itemName: string;
  message: string;
};

export async function getActiveNudges(): Promise<WishlistNudge[]> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return [];

  const { data, error } = await supabase
    .from("wishlist_items")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "wishlist")
    .eq("enriched", true)
    .order("last_score", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("Error fetching nudge candidates:", error);
    return [];
  }

  const items = (data ?? []) as WishlistItem[];
  const now = Date.now();
  const DAY_MS = 1000 * 60 * 60 * 24;

  const nudges: WishlistNudge[] = [];

  for (const item of items) {
    // Skip items with recently dismissed nudges (24h cooldown)
    if (item.last_nudge_dismissed_at) {
      const dismissedAt = new Date(item.last_nudge_dismissed_at).getTime();
      if (now - dismissedAt < 24 * 60 * 60 * 1000) continue;
    }

    const isGreen =
      item.last_verdict === "BUY" || item.last_verdict === "BUY_WITH_CAUTION";
    const score = item.last_score ?? 0;

    // Score transition: ready_at within 7 days
    if (item.ready_at) {
      const readyAt = new Date(item.ready_at).getTime();
      const daysSinceReady = (now - readyAt) / DAY_MS;
      if (daysSinceReady <= 7 && isGreen) {
        nudges.push({
          type: "score_transition",
          itemId: item.id,
          itemName: item.name,
          message: `"${item.name}" acaba de pasar a verde. Tu situación financiera permite esta compra.`,
        });
      }
    }

    // Desire maturity: 30+ days old, green score
    const createdAt = new Date(item.created_at).getTime();
    const daysSinceCreated = (now - createdAt) / DAY_MS;
    if (daysSinceCreated >= 30 && isGreen && score >= 55) {
      nudges.push({
        type: "desire_maturity",
        itemId: item.id,
        itemName: item.name,
        message: `Llevas más de 30 días queriendo "${item.name}" y tu puntaje es favorable. ¿Es hora de decidir?`,
      });
    }
  }

  // Priority: debt_milestone > score_transition > budget_surplus > desire_maturity
  const priorityOrder: WishlistNudge["type"][] = [
    "debt_milestone",
    "score_transition",
    "budget_surplus",
    "desire_maturity",
  ];

  nudges.sort((a, b) => {
    return priorityOrder.indexOf(a.type) - priorityOrder.indexOf(b.type);
  });

  // Return max 1 nudge
  return nudges.slice(0, 1);
}

export async function dismissNudge(
  itemId: string
): Promise<ActionResult<void>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("wishlist_items")
    .update({
      last_nudge_dismissed_at: now,
      updated_at: now,
    })
    .eq("id", itemId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error dismissing nudge:", error);
    return { success: false, error: "Error al descartar el aviso" };
  }

  return { success: true, data: undefined };
}

// ─── Section 6: Pending Reflections ─────────────────────────────────────────

export async function getPendingReflections(): Promise<WishlistItem[]> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return [];

  const now = Date.now();
  const DAY_MS = 1000 * 60 * 60 * 24;

  // Fetch bought + reflected items in parallel
  const [{ data: boughtItems, error: boughtError }, { data: reflectedItems, error: reflectedError }] =
    await Promise.all([
      supabase
        .from("wishlist_items")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "bought")
        .order("bought_at", { ascending: true }),
      supabase
        .from("wishlist_items")
        .select("*, wishlist_reflections(id)")
        .eq("user_id", user.id)
        .eq("status", "reflected")
        .order("bought_at", { ascending: true }),
    ]);

  if (boughtError || reflectedError) return [];

  const pending: WishlistItem[] = [];

  // Bought items 14+ days old
  for (const item of (boughtItems ?? []) as WishlistItem[]) {
    if (!item.bought_at) continue;
    const boughtAt = new Date(item.bought_at).getTime();
    const daysSinceBought = (now - boughtAt) / DAY_MS;
    if (daysSinceBought >= 14) {
      pending.push(item);
    }
  }

  // Reflected items 60+ days old with only 1 reflection (expensive follow-up)
  type ReflectedWithCount = WishlistItem & {
    wishlist_reflections: { id: string }[];
  };
  for (const raw of (reflectedItems ?? []) as ReflectedWithCount[]) {
    if (!raw.bought_at) continue;
    const boughtAt = new Date(raw.bought_at).getTime();
    const daysSinceBought = (now - boughtAt) / DAY_MS;
    if (daysSinceBought >= 60 && raw.wishlist_reflections.length === 1) {
      // Strip the join data before returning
      const { wishlist_reflections: _, ...item } = raw;
      pending.push(item as WishlistItem);
    }
  }

  return pending;
}
