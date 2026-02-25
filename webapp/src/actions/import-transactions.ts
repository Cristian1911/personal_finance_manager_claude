"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { importPayloadSchema } from "@/lib/validators/import";
import { computeIdempotencyKey } from "@/lib/utils/idempotency";
import { computeSnapshotDiffs } from "@venti5/shared";
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
      installmentCurrent: tx.installment_current,
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
      installment_current: tx.installment_current ?? null,
      installment_total: tx.installment_total ?? null,
      installment_group_id: tx.installment_group_id ?? null,
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
    // Pre-fetch accounts to get existing currency_balances and primary currency
    const uniqueAccountIds = [...new Set(statementMeta.map((m) => m.accountId))];
    const { data: accountRows } = await supabase
      .from("accounts")
      .select("id, name, currency_code, currency_balances")
      .in("id", uniqueAccountIds);
    const accountMap = new Map(
      (accountRows ?? []).map((a) => [a.id, a])
    );

    // Accumulate currency_balances per account across all metas
    const pendingBalances = new Map<
      string,
      Record<string, Record<string, number | null>>
    >();
    for (const id of uniqueAccountIds) {
      const existing = accountMap.get(id)?.currency_balances;
      pendingBalances.set(
        id,
        (existing && typeof existing === "object" && !Array.isArray(existing)
          ? existing
          : {}) as Record<string, Record<string, number | null>>
      );
    }

    for (const meta of statementMeta) {
      // Fetch previous snapshot for this account + currency
      const { data: prevSnapshot } = await supabase
        .from("statement_snapshots")
        .select("*")
        .eq("account_id", meta.accountId)
        .eq("currency_code", meta.currency)
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
        interest_rate: meta.creditCardMetadata?.interest_rate ?? meta.loanMetadata?.interest_rate ?? null,
        late_interest_rate: meta.creditCardMetadata?.late_interest_rate ?? meta.loanMetadata?.late_interest_rate ?? null,
        total_payment_due: meta.creditCardMetadata?.total_payment_due ?? meta.loanMetadata?.total_payment_due ?? null,
        minimum_payment: meta.creditCardMetadata?.minimum_payment ?? meta.loanMetadata?.minimum_payment ?? null,
        payment_due_date: meta.creditCardMetadata?.payment_due_date ?? meta.loanMetadata?.payment_due_date ?? null,
        remaining_balance: meta.loanMetadata?.remaining_balance ?? null,
        initial_amount: meta.loanMetadata?.initial_amount ?? null,
        installments_in_default: meta.loanMetadata?.installments_in_default ?? null,
        loan_number: meta.loanMetadata?.loan_number ?? null,
        transaction_count: meta.transactionCount,
        imported_count: imported,
        skipped_count: skipped,
        currency_code: meta.currency,
        source_filename: meta.sourceFilename ?? null,
      };

      // Check if a snapshot for this account + period + currency already exists
      let existingQuery = supabase
        .from("statement_snapshots")
        .select("id")
        .eq("account_id", meta.accountId)
        .eq("currency_code", meta.currency);
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

      // Build per-currency balance entry
      const currencyEntry: Record<string, number | null> = {};
      if (meta.creditCardMetadata) {
        const cc = meta.creditCardMetadata;
        currencyEntry.credit_limit = cc.credit_limit ?? null;
        currencyEntry.available_balance = cc.available_credit ?? null;
        currencyEntry.interest_rate = cc.interest_rate ?? null;
        currencyEntry.minimum_payment = cc.minimum_payment ?? null;
        currencyEntry.total_payment_due = cc.total_payment_due ?? null;
        if (cc.total_payment_due != null) {
          currencyEntry.current_balance = cc.total_payment_due;
        } else if (cc.credit_limit != null && cc.available_credit != null) {
          currencyEntry.current_balance = Math.max(cc.credit_limit - cc.available_credit, 0);
        } else {
          currencyEntry.current_balance = null;
        }
      } else if (meta.loanMetadata) {
        const ln = meta.loanMetadata;
        currencyEntry.current_balance = ln.remaining_balance ?? null;
        currencyEntry.interest_rate = ln.interest_rate ?? null;
        currencyEntry.total_payment_due = ln.total_payment_due ?? null;
      } else if (meta.summary?.final_balance != null) {
        currencyEntry.current_balance = meta.summary.final_balance;
      }

      // Merge into pending balances for this account
      const balances = pendingBalances.get(meta.accountId)!;
      balances[meta.currency] = currencyEntry;

      // Update primary scalar fields only for the account's main currency
      const account = accountMap.get(meta.accountId);
      const accountUpdate: Record<string, unknown> = {
        last_synced_at: new Date().toISOString(),
      };

      const isPrimaryCurrency = account?.currency_code === meta.currency;

      if (meta.creditCardMetadata && isPrimaryCurrency) {
        const cc = meta.creditCardMetadata;
        if (cc.credit_limit != null) accountUpdate.credit_limit = cc.credit_limit;
        if (cc.interest_rate != null) accountUpdate.interest_rate = cc.interest_rate;
        if (cc.total_payment_due != null) {
          accountUpdate.current_balance = cc.total_payment_due;
        } else if (cc.credit_limit != null && cc.available_credit != null) {
          accountUpdate.current_balance = Math.max(cc.credit_limit - cc.available_credit, 0);
        }
        if (cc.available_credit != null) accountUpdate.available_balance = cc.available_credit;
        if (cc.payment_due_date) {
          accountUpdate.payment_day = new Date(cc.payment_due_date).getUTCDate();
        }
        if (cc.minimum_payment != null) accountUpdate.monthly_payment = cc.minimum_payment;
      } else if (meta.loanMetadata && isPrimaryCurrency) {
        const ln = meta.loanMetadata;
        if (ln.remaining_balance != null) accountUpdate.current_balance = ln.remaining_balance;
        if (ln.interest_rate != null) accountUpdate.interest_rate = ln.interest_rate;
        if (ln.payment_due_date) {
          accountUpdate.payment_day = new Date(ln.payment_due_date).getUTCDate();
        }
        if (ln.minimum_payment != null) accountUpdate.monthly_payment = ln.minimum_payment;
      } else if (!meta.creditCardMetadata && !meta.loanMetadata && meta.summary?.final_balance != null && isPrimaryCurrency) {
        accountUpdate.current_balance = meta.summary.final_balance;
      }

      // Write currency_balances JSONB with all accumulated data so far
      accountUpdate.currency_balances = balances;

      await supabase
        .from("accounts")
        .update(accountUpdate)
        .eq("id", meta.accountId);

      // Compute diffs between previous and current snapshot
      const diffs = computeSnapshotDiffs(prevSnapshot, snapshotRow);

      accountUpdates.push({
        accountId: meta.accountId,
        accountName: account?.name ?? "",
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
