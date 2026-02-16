"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { importPayloadSchema } from "@/lib/validators/import";
import { computeIdempotencyKey } from "@/lib/utils/idempotency";
import { computeSnapshotDiffs } from "@/lib/utils/snapshot-diff";
import type { ActionResult } from "@/types/actions";
import type { ImportResult, AccountUpdateResult } from "@/types/import";

export async function importTransactions(
  _prevState: ActionResult<ImportResult>,
  formData: FormData
): Promise<ActionResult<ImportResult>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  const rawPayload = formData.get("payload") as string;
  let parsed;
  try {
    parsed = importPayloadSchema.safeParse(JSON.parse(rawPayload));
  } catch {
    return { success: false, error: "Datos inválidos" };
  }

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { transactions, statementMeta } = parsed.data;
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  const details: string[] = [];

  // --- Insert transactions (unchanged) ---
  for (const tx of transactions) {
    const idempotencyKey = await computeIdempotencyKey({
      provider: "OCR",
      transactionDate: tx.transaction_date,
      amount: tx.amount,
      rawDescription: tx.raw_description,
    });

    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      account_id: tx.account_id,
      amount: tx.amount,
      currency_code: tx.currency_code,
      direction: tx.direction,
      transaction_date: tx.transaction_date,
      raw_description: tx.raw_description,
      clean_description: tx.raw_description,
      idempotency_key: idempotencyKey,
      provider: "OCR",
      category_id: tx.category_id ?? null,
      categorization_source: tx.categorization_source ?? "SYSTEM_DEFAULT",
      categorization_confidence: tx.categorization_confidence ?? null,
      status: "POSTED",
    });

    if (error) {
      if (error.code === "23505") {
        skipped++;
      } else {
        errors++;
        details.push(`${tx.raw_description}: ${error.message}`);
      }
    } else {
      imported++;
    }
  }

  // --- Process statement metadata: update accounts + create snapshots ---
  const accountUpdates: AccountUpdateResult[] = [];

  if (statementMeta && statementMeta.length > 0) {
    for (const meta of statementMeta) {
      // Fetch previous snapshot for this account
      const { data: prevSnapshot } = await supabase
        .from("statement_snapshots")
        .select("*")
        .eq("account_id", meta.accountId)
        .order("period_to", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Build new snapshot row
      const snapshotRow = {
        user_id: user.id,
        account_id: meta.accountId,
        period_from: meta.periodFrom,
        period_to: meta.periodTo,
        previous_balance: meta.summary?.previous_balance ?? null,
        total_credits: meta.summary?.total_credits ?? null,
        total_debits: meta.summary?.total_debits ?? null,
        final_balance: meta.summary?.final_balance ?? null,
        purchases_and_charges: meta.summary?.purchases_and_charges ?? null,
        interest_charged: meta.summary?.interest_charged ?? null,
        credit_limit: meta.creditCardMetadata?.credit_limit ?? null,
        available_credit: meta.creditCardMetadata?.available_credit ?? null,
        interest_rate: meta.creditCardMetadata?.interest_rate ?? null,
        late_interest_rate: meta.creditCardMetadata?.late_interest_rate ?? null,
        total_payment_due: meta.creditCardMetadata?.total_payment_due ?? null,
        minimum_payment: meta.creditCardMetadata?.minimum_payment ?? null,
        payment_due_date: meta.creditCardMetadata?.payment_due_date ?? null,
        transaction_count: meta.transactionCount,
        imported_count: imported,
        skipped_count: skipped,
        currency_code: meta.currency,
        source_filename: meta.sourceFilename ?? null,
      };

      // Check if a snapshot for this account + period already exists
      let existingQuery = supabase
        .from("statement_snapshots")
        .select("id")
        .eq("account_id", meta.accountId);
      existingQuery = meta.periodFrom
        ? existingQuery.eq("period_from", meta.periodFrom)
        : existingQuery.is("period_from", null);
      existingQuery = meta.periodTo
        ? existingQuery.eq("period_to", meta.periodTo)
        : existingQuery.is("period_to", null);
      const { data: existingSnapshot } = await existingQuery.maybeSingle();

      if (existingSnapshot) {
        await supabase
          .from("statement_snapshots")
          .update(snapshotRow)
          .eq("id", existingSnapshot.id);
      } else {
        await supabase
          .from("statement_snapshots")
          .insert(snapshotRow);
      }

      // Update account metadata from statement
      const accountUpdate: Record<string, unknown> = {
        last_synced_at: new Date().toISOString(),
      };

      if (meta.creditCardMetadata) {
        const cc = meta.creditCardMetadata;
        if (cc.credit_limit != null) accountUpdate.credit_limit = cc.credit_limit;
        if (cc.interest_rate != null) accountUpdate.interest_rate = cc.interest_rate;
        if (cc.total_payment_due != null) {
          accountUpdate.current_balance = cc.total_payment_due;
        } else if (cc.credit_limit != null && cc.available_credit != null) {
          // Fallback: derive debt from limit − available credit
          accountUpdate.current_balance = Math.max(cc.credit_limit - cc.available_credit, 0);
        }
        if (cc.available_credit != null) accountUpdate.available_balance = cc.available_credit;
        if (cc.payment_due_date) {
          accountUpdate.payment_day = new Date(cc.payment_due_date).getUTCDate();
        }
      } else if (meta.summary?.final_balance != null) {
        // For savings accounts: update balance from statement
        accountUpdate.current_balance = meta.summary.final_balance;
      }

      await supabase
        .from("accounts")
        .update(accountUpdate)
        .eq("id", meta.accountId);

      // Compute diffs between previous and current snapshot
      const diffs = computeSnapshotDiffs(prevSnapshot, snapshotRow);

      // Fetch account name for display
      const { data: acct } = await supabase
        .from("accounts")
        .select("name")
        .eq("id", meta.accountId)
        .single();

      accountUpdates.push({
        accountId: meta.accountId,
        accountName: acct?.name ?? "",
        diffs,
        isFirstImport: !prevSnapshot,
      });
    }
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  revalidatePath("/deudas");

  return {
    success: true,
    data: { imported, skipped, errors, details, accountUpdates },
  };
}
