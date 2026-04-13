"use server";

import { cacheTag, cacheLife, revalidateTag } from "next/cache";
import { revalidateFinancialViews } from "@/lib/cache/revalidation";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { extractPattern, matchDestinatario, prepareDestinatarioRules } from "@zeta/shared";
import { fetchDestinatarioRules } from "./destinatarios";
import { uuidStr } from "@/lib/validators/shared";
import { z } from "zod";
import type { ActionResult } from "@/types/actions";
import type { TransactionWithAccount } from "@/types/domain";
import type { UserRule } from "@zeta/shared";

type DestinatarioSuggestionMap = Record<string, {
  destinatario_id: string;
  destinatario_name: string;
  category_id: string | null;
}>;

const bulkMatchSchema = z.array(z.object({
  transactionId: uuidStr(),
  destinatarioId: uuidStr(),
  categoryId: uuidStr().nullable(),
}));

// ─── Cached inner functions ───────────────────────────────────────────────────

async function getUncategorizedTransactionsCached(
  userId: string,
  accessToken: string
): Promise<TransactionWithAccount[]> {
  "use cache";
  cacheTag("categorize");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  const { data, error } = await supabase
    .from("transactions")
    .select(
      "*, account:accounts!transactions_account_id_fkey(id, name, icon, color), category:categories!transactions_category_id_fkey(id, name, name_es, icon, color), destinatario:destinatarios!transactions_destinatario_id_fkey(id, name)"
    )
    .eq("user_id", userId)
    .is("category_id", null)
    .eq("is_excluded", false)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .is("reconciled_into_transaction_id", null);
  if (error) throw error;
  return (data ?? []) as TransactionWithAccount[];
}

async function getUncategorizedCountCached(userId: string, accessToken: string): Promise<number> {
  "use cache";
  cacheTag("categorize");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  const { count, error } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("category_id", null)
    .eq("is_excluded", false)
    .is("reconciled_into_transaction_id", null);
  if (error) throw error;
  return count ?? 0;
}

async function getUserCategoryRulesCached(userId: string, accessToken: string): Promise<UserRule[]> {
  "use cache";
  cacheTag("categorize");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  const { data, error } = await supabase
    .from("category_rules")
    .select("pattern, category_id")
    .eq("user_id", userId)
    .order("match_count", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

async function getUnreviewedAutoCategorizedCached(
  userId: string,
  accessToken: string
): Promise<TransactionWithAccount[]> {
  "use cache";
  cacheTag("categorize");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  const { data, error } = await supabase
    .from("transactions")
    .select(
      "*, account:accounts!transactions_account_id_fkey(id, name, icon, color), category:categories!transactions_category_id_fkey(id, name, name_es, icon, color), destinatario:destinatarios!transactions_destinatario_id_fkey(id, name)"
    )
    .eq("user_id", userId)
    .not("category_id", "is", null)
    .in("categorization_source", ["SYSTEM_DEFAULT"])
    .eq("is_excluded", false)
    .is("reconciled_into_transaction_id", null)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as TransactionWithAccount[];
}

async function getUnreviewedAutoCountCached(userId: string, accessToken: string): Promise<number> {
  "use cache";
  cacheTag("categorize");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  const { count, error } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("category_id", "is", null)
    .in("categorization_source", ["SYSTEM_DEFAULT"])
    .eq("is_excluded", false)
    .is("reconciled_into_transaction_id", null);
  if (error) throw error;
  return count ?? 0;
}

// ─── Public wrappers ──────────────────────────────────────────────────────────

/**
 * Fetch all uncategorized, non-excluded transactions with account + category joins.
 */
export async function getUncategorizedTransactions(): Promise<
  TransactionWithAccount[]
> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return [];
  try {
    return await getUncategorizedTransactionsCached(user.id, accessToken);
  } catch (err) {
    console.error("Error fetching uncategorized transactions:", err);
    return [];
  }
}

/**
 * Count uncategorized, non-excluded transactions (for sidebar badge).
 */
export async function getUncategorizedCount(): Promise<number> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return 0;
  try {
    return await getUncategorizedCountCached(user.id, accessToken);
  } catch (err) {
    if (err && typeof err === "object" && "message" in err) {
      console.warn("Error counting uncategorized:", (err as { message: string }).message);
    }
    return 0;
  }
}

/**
 * Fetch user's category rules for auto-categorization.
 */
export async function getUserCategoryRules(): Promise<UserRule[]> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return [];
  try {
    return await getUserCategoryRulesCached(user.id, accessToken);
  } catch (err) {
    console.error("Error fetching category rules:", err);
    return [];
  }
}

/**
 * Fetch auto-categorized transactions not yet reviewed by the user.
 * These have categorization_source = SYSTEM_DEFAULT and a non-null category.
 */
export async function getUnreviewedAutoTransactions(): Promise<
  TransactionWithAccount[]
> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return [];
  try {
    return await getUnreviewedAutoCategorizedCached(user.id, accessToken);
  } catch (err) {
    console.error("Error fetching unreviewed auto-categorized:", err);
    return [];
  }
}

/**
 * Count auto-categorized transactions not yet reviewed (for badge).
 */
export async function getUnreviewedAutoCount(): Promise<number> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return 0;
  try {
    return await getUnreviewedAutoCountCached(user.id, accessToken);
  } catch (err) {
    console.error("Error fetching unreviewed auto count:", err);
    return 0;
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Categorize a single transaction and learn the pattern.
 */
export async function categorizeTransaction(
  txId: string,
  categoryId: string
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // 1. Fetch the transaction to extract a pattern
  const { data: tx, error: fetchError } = await supabase
    .from("transactions")
    .select("merchant_name, clean_description, raw_description, destinatario_id")
    .eq("user_id", user.id)
    .eq("id", txId)
    .single();

  if (fetchError || !tx) {
    return { success: false, error: "Transacción no encontrada" };
  }

  // 2. Update the transaction category
  const { error: updateError } = await supabase
    .from("transactions")
    .update({
      category_id: categoryId,
      categorization_source: "USER_OVERRIDE",
      categorization_confidence: null,
    })
    .eq("user_id", user.id)
    .eq("id", txId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // 3. Extract pattern and upsert category rule
  const pattern = extractPattern(
    tx.merchant_name,
    tx.clean_description,
    tx.raw_description
  );

  if (pattern) {
    await supabase.from("category_rules").upsert(
      {
        user_id: user.id,
        pattern,
        category_id: categoryId,
        match_count: 1,
      },
      { onConflict: "user_id,pattern" }
    );
    // If the rule already existed, increment match_count
    // The upsert with onConflict will replace — we use an RPC or just accept the reset for now
  }

  // 4. Learn destinatario default category (conditional update — no-ops if already set)
  if (tx.destinatario_id) {
    await supabase
      .from("destinatarios")
      .update({ default_category_id: categoryId })
      .eq("user_id", user.id)
      .eq("id", tx.destinatario_id)
      .is("default_category_id", null);
  }

  revalidateFinancialViews();
  revalidateTag("destinatarios", "zeta");
  return { success: true, data: undefined };
}

/**
 * Remove the category from a transaction (undo categorization).
 */
export async function uncategorizeTransaction(
  txId: string
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("transactions")
    .update({
      category_id: null,
      categorization_source: null as unknown as undefined,
      categorization_confidence: null,
    })
    .eq("user_id", user.id)
    .eq("id", txId);

  if (error) return { success: false, error: error.message };

  revalidateFinancialViews();
  return { success: true, data: undefined };
}

/**
 * Confirm an auto-categorized transaction, marking it as user-reviewed.
 * Keeps the existing category but changes categorization_source to USER_OVERRIDE.
 */
export async function confirmAutoCategory(
  transactionId: string
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("transactions")
    .update({ categorization_source: "USER_OVERRIDE" })
    .eq("id", transactionId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidateFinancialViews();
  return { success: true, data: undefined };
}

/**
 * Confirm multiple auto-categorized transactions at once.
 */
export async function bulkConfirmAutoCategory(
  transactionIds: string[]
): Promise<ActionResult<{ confirmed: number }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error, count } = await supabase
    .from("transactions")
    .update({ categorization_source: "USER_OVERRIDE" })
    .eq("user_id", user.id)
    .in("id", transactionIds)
    .in("categorization_source", ["SYSTEM_DEFAULT"]);

  if (error) return { success: false, error: error.message };

  revalidateFinancialViews();
  return { success: true, data: { confirmed: count ?? transactionIds.length } };
}

/**
 * Categorize multiple transactions at once and learn patterns.
 */
export async function bulkCategorize(
  items: { txId: string; categoryId: string }[]
): Promise<ActionResult<{ categorized: number }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  let categorized = 0;

  // Fetch all transactions in one query for pattern extraction
  const txIds = items.map((i) => i.txId);
  const { data: txs } = await supabase
    .from("transactions")
    .select("id, merchant_name, clean_description, raw_description")
    .eq("user_id", user.id)
    .in("id", txIds);

  const txMap = new Map(txs?.map((t) => [t.id, t]) ?? []);

  // Process each item
  for (const { txId, categoryId } of items) {
    const { error } = await supabase
      .from("transactions")
      .update({
        category_id: categoryId,
        categorization_source: "USER_OVERRIDE",
        categorization_confidence: null,
      })
      .eq("user_id", user.id)
      .eq("id", txId);

    if (!error) {
      categorized++;

      // Learn the pattern
      const tx = txMap.get(txId);
      if (tx) {
        const pattern = extractPattern(
          tx.merchant_name,
          tx.clean_description,
          tx.raw_description
        );
        if (pattern) {
          await supabase.from("category_rules").upsert(
            {
              user_id: user.id,
              pattern,
              category_id: categoryId,
              match_count: 1,
            },
            { onConflict: "user_id,pattern" }
          );
        }
      }
    }
  }

  revalidateFinancialViews();
  revalidateTag("destinatarios", "zeta");
  return { success: true, data: { categorized } };
}

/**
 * Assign a destinatario to a transaction and learn a matching rule.
 */
export async function assignDestinatario(
  transactionId: string,
  destinatarioId: string
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // 1. Fetch transaction and destinatario in parallel
  const [txResult, destResult] = await Promise.all([
    supabase
      .from("transactions")
      .select("raw_description, category_id")
      .eq("user_id", user.id)
      .eq("id", transactionId)
      .single(),
    supabase
      .from("destinatarios")
      .select("name, default_category_id")
      .eq("user_id", user.id)
      .eq("id", destinatarioId)
      .single(),
  ]);

  const { data: tx, error: txError } = txResult;
  if (txError || !tx) {
    return { success: false, error: "Transacción no encontrada" };
  }

  const { data: dest, error: destError } = destResult;
  if (destError || !dest) {
    return { success: false, error: "Destinatario no encontrado" };
  }

  // 3. Build update payload
  const updatePayload: {
    destinatario_id: string;
    merchant_name: string;
    category_id?: string;
    categorization_source?: "USER_LEARNED";
  } = {
    destinatario_id: destinatarioId,
    merchant_name: dest.name,
  };

  // If the destinatario has a default category and the transaction has none, apply it
  if (dest.default_category_id && !tx.category_id) {
    updatePayload.category_id = dest.default_category_id;
    updatePayload.categorization_source = "USER_LEARNED";
  }

  const { error: updateError } = await supabase
    .from("transactions")
    .update(updatePayload)
    .eq("user_id", user.id)
    .eq("id", transactionId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  // 4. Extract pattern and create a destinatario_rule
  const pattern = extractPattern(null, null, tx.raw_description);

  if (pattern) {
    await supabase.from("destinatario_rules").upsert(
      {
        user_id: user.id,
        destinatario_id: destinatarioId,
        pattern,
        match_type: "contains" as const,
      },
      { onConflict: "user_id,pattern", ignoreDuplicates: true }
    );
  }

  revalidateFinancialViews();
  revalidateTag("destinatarios", "zeta");
  return { success: true, data: undefined };
}

/**
 * Cached computation of destinatario suggestions for uncategorized transactions.
 * Keyed on userId + accessToken; dual-tagged so it invalidates on either data change.
 */
async function computeDestinatarioSuggestionsCached(
  userId: string,
  accessToken: string
): Promise<DestinatarioSuggestionMap> {
  "use cache";
  cacheTag("categorize");
  cacheTag("destinatarios");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const [transactions, rules] = await Promise.all([
    getUncategorizedTransactionsCached(userId, accessToken),
    fetchDestinatarioRules(supabase, userId),
  ]);

  if (rules.length === 0 || transactions.length === 0) return {};

  const prepared = prepareDestinatarioRules(rules);
  const suggestions: DestinatarioSuggestionMap = {};

  for (const tx of transactions) {
    const text = tx.merchant_name ?? tx.clean_description ?? tx.raw_description ?? "";
    if (!text) continue;

    const match = matchDestinatario(text, prepared);
    if (match) {
      suggestions[tx.id] = {
        destinatario_id: match.destinatario_id,
        destinatario_name: match.destinatario_name,
        category_id: match.category_id ?? null,
      };
    }
  }

  return suggestions;
}

/**
 * Return a map of transaction ID → destinatario match for all uncategorized
 * transactions. Used to surface the "Aplicar todos" banner in the inbox.
 */
export async function getDestinatarioSuggestionsForInbox(): Promise<DestinatarioSuggestionMap> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return {};
  return computeDestinatarioSuggestionsCached(user.id, accessToken);
}

/**
 * Bulk-assign destinatario (and optionally category) to a list of transactions.
 */
export async function bulkApplyDestinatarioMatches(
  matches: Array<{ transactionId: string; destinatarioId: string; categoryId: string | null }>
): Promise<ActionResult<{ applied: number }>> {
  const parsed = bulkMatchSchema.safeParse(matches);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // Group by destinatario+category to batch updates instead of N+1
  const groups = new Map<string, { destinatarioId: string; categoryId: string | null; txIds: string[] }>();
  for (const m of parsed.data) {
    const key = `${m.destinatarioId}|${m.categoryId ?? ""}`;
    const group = groups.get(key) ?? { destinatarioId: m.destinatarioId, categoryId: m.categoryId, txIds: [] };
    group.txIds.push(m.transactionId);
    groups.set(key, group);
  }

  const results = await Promise.all(
    Array.from(groups.values()).map(async (group) => {
      const payload = group.categoryId
        ? {
            destinatario_id: group.destinatarioId,
            category_id: group.categoryId,
            categorization_source: "USER_LEARNED" as const,
          }
        : { destinatario_id: group.destinatarioId };
      const { error } = await supabase
        .from("transactions")
        .update(payload)
        .in("id", group.txIds)
        .eq("user_id", user.id);
      if (error) {
        console.error("Error in bulkApplyDestinatarioMatches batch:", error);
        return 0;
      }
      return group.txIds.length;
    })
  );

  revalidateFinancialViews();
  revalidateTag("destinatarios", "zeta");

  return { success: true, data: { applied: results.reduce((sum, n) => sum + n, 0) } };
}

/**
 * Remove the destinatario assignment from a transaction.
 */
export async function removeDestinatarioFromTransaction(
  transactionId: string
): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("transactions")
    .update({ destinatario_id: null, merchant_name: null })
    .eq("user_id", user.id)
    .eq("id", transactionId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidateFinancialViews();
  revalidateTag("destinatarios", "zeta");
  return { success: true, data: undefined };
}
