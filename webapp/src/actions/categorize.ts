"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { extractPattern } from "@zeta/shared";
import { executeVisibleTransactionQuery } from "@/lib/utils/transactions";
import type { ActionResult } from "@/types/actions";
import type { TransactionWithRelations } from "@/types/domain";
import type { UserRule } from "@zeta/shared";

/**
 * Fetch all uncategorized, non-excluded transactions with account + category joins.
 */
export async function getUncategorizedTransactions(): Promise<
  TransactionWithRelations[]
> {
  const { supabase, user } = await getAuthenticatedClient();
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
  const { supabase, user } = await getAuthenticatedClient();
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
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return [];

  const { data, error } = await supabase
    .from("category_rules")
    .select("pattern, category_id")
    .eq("user_id", user.id)
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

  revalidatePath("/categorizar");
  revalidatePath("/transactions");
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

  revalidatePath("/transactions");
  revalidatePath("/destinatarios");
  return { success: true, data: undefined };
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

  revalidatePath("/transactions");
  return { success: true, data: undefined };
}
