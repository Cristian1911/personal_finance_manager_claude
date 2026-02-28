"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUserSafely } from "@/lib/supabase/auth";
import { extractPattern } from "@venti5/shared";
import { executeVisibleTransactionQuery } from "@/lib/utils/transactions";
import type { ActionResult } from "@/types/actions";
import type { TransactionWithRelations } from "@/types/domain";
import type { UserRule } from "@venti5/shared";

/**
 * Fetch all uncategorized, non-excluded transactions with account + category joins.
 */
export async function getUncategorizedTransactions(): Promise<
  TransactionWithRelations[]
> {
  const supabase = await createClient();
  const user = await getUserSafely(supabase);
  if (!user) return [];

  const { data, error } = await executeVisibleTransactionQuery(() =>
    supabase
      .from("transactions")
      .select("*, account:accounts(id, name, icon, color), category:categories!category_id(id, name, name_es, icon, color)")
      .is("category_id", null)
      .eq("is_excluded", false)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
  );

  if (error) {
    console.error("Error fetching uncategorized transactions:", error);
    return [];
  }

  return (data ?? []) as TransactionWithRelations[];
}

/**
 * Count uncategorized, non-excluded transactions (for sidebar badge).
 */
export async function getUncategorizedCount(): Promise<number> {
  const supabase = await createClient();
  const user = await getUserSafely(supabase);
  if (!user) return 0;

  const { count, error } = await executeVisibleTransactionQuery(() =>
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .is("category_id", null)
      .eq("is_excluded", false)
  );

  if (error) {
    if (error.message) {
      console.warn("Error counting uncategorized:", error.message);
    }
    return 0;
  }

  return count ?? 0;
}

/**
 * Fetch user's category rules for auto-categorization.
 */
export async function getUserCategoryRules(): Promise<UserRule[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("category_rules")
    .select("pattern, category_id")
    .order("match_count", { ascending: false });

  if (error) {
    console.error("Error fetching category rules:", error);
    return [];
  }

  return data ?? [];
}

/**
 * Categorize a single transaction and learn the pattern.
 */
export async function categorizeTransaction(
  txId: string,
  categoryId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  // 1. Fetch the transaction to extract a pattern
  const { data: tx, error: fetchError } = await supabase
    .from("transactions")
    .select("merchant_name, clean_description, raw_description")
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

  revalidatePath("/categorizar");
  revalidatePath("/transactions");
  return { success: true, data: undefined };
}

/**
 * Categorize multiple transactions at once and learn patterns.
 */
export async function bulkCategorize(
  items: { txId: string; categoryId: string }[]
): Promise<ActionResult<{ categorized: number }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  let categorized = 0;

  // Fetch all transactions in one query for pattern extraction
  const txIds = items.map((i) => i.txId);
  const { data: txs } = await supabase
    .from("transactions")
    .select("id, merchant_name, clean_description, raw_description")
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

  revalidatePath("/categorizar");
  revalidatePath("/transactions");
  return { success: true, data: { categorized } };
}
