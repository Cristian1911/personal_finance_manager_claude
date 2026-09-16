import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ImportShareConfig } from "@/types/import";
import { splitExistingTransaction } from "@/actions/shared-payments";
import { recomputeSplitRepaid } from "@/lib/personal-debts/recompute";
import {
  estimateInstallmentPlan,
  getCurrencyDecimals,
  isInstallmentPurchase,
  type CurrencyCode,
  type InstallmentPlan,
} from "@zeta/shared";

/**
 * "Compartido con…" decided in the import review step, applied AFTER the rows
 * exist (and after reconciliation picked the survivor ids).
 *
 * - A normal row is split on its own amount, exactly like "Repartir" on an
 *   existing transaction.
 * - A purchase in cuotas is charged as the WHOLE purchase once: precio +
 *   interés estimado (French annuity on the statement's EA rate). The debts
 *   are keyed by `installment_group_id`, so cuotas that arrive in later
 *   statements attach to the existing group (same `split_group_id`, no new
 *   debts) and the repaid total is re-spread across them.
 *
 * Never throws: sharing is an enrichment on rows that already moved balances,
 * so a failure is reported back and the import still succeeds.
 */
export type ShareRowInput = {
  transactionId: string;
  amount: number;
  currency_code: string;
  transaction_date: string;
  raw_description: string;
  installment_group_id: string | null;
  installment_current: number | null;
  installment_total: number | null;
  original_amount: number | null;
  share: ImportShareConfig;
};

export type ShareImportedRowsResult = {
  sharedCount: number;
  installmentLinkedCount: number;
  errors: string[];
  notes: string[];
};

const CONCURRENCY = 4;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function toConfig(row: ShareRowInput, description: string) {
  return {
    method: row.share.method,
    userIncluded: row.share.userIncluded,
    participants: row.share.participants.map((p) => ({
      destinatario_id: p.destinatario_id,
      value: p.value,
    })),
    opened_on: row.transaction_date,
    description,
  };
}

export async function shareImportedRows(
  supabase: SupabaseClient<Database>,
  userId: string,
  rows: ShareRowInput[],
): Promise<ShareImportedRowsResult> {
  const result: ShareImportedRowsResult = { sharedCount: 0, installmentLinkedCount: 0, errors: [], notes: [] };
  if (rows.length === 0) return result;

  // Parsers stamp 1/1 on every one-time card purchase: only a real N > 1 plan
  // takes the whole-purchase path; 1/1 rows are ordinary splits on their amount.
  const isCuotas = (r: ShareRowInput) => !!r.installment_group_id && isInstallmentPurchase(r);
  const plain = rows.filter((r) => !isCuotas(r));
  const byGroup = new Map<string, ShareRowInput[]>();
  for (const r of rows) {
    if (!isCuotas(r) || !r.installment_group_id) continue;
    const arr = byGroup.get(r.installment_group_id) ?? [];
    arr.push(r);
    byGroup.set(r.installment_group_id, arr);
  }

  // ── Plain rows: independent splits, bounded concurrency. ──
  for (const batch of chunk(plain, CONCURRENCY)) {
    const outcomes = await Promise.all(
      batch.map((row) =>
        splitExistingTransaction(
          supabase,
          userId,
          { id: row.transactionId, amount: row.amount, currency_code: row.currency_code },
          toConfig(row, row.raw_description),
        ).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Error inesperado" })),
      ),
    );
    outcomes.forEach((o, i) => {
      if (o.ok) result.sharedCount += 1;
      else result.errors.push(`Reparto: ${batch[i].raw_description}: ${o.error}`);
    });
  }

  if (byGroup.size === 0) return result;

  // ── Cuotas: one lookup for every purchase already shared by this user. ──
  const groupKeys = [...byGroup.keys()];
  const existingResults = await Promise.all(
    chunk(groupKeys, 100).map((keys) =>
      supabase
        .from("personal_debts")
        .select("installment_group_id, split_group_id")
        .eq("user_id", userId)
        .in("installment_group_id", keys)
        .not("split_group_id", "is", null),
    ),
  );
  const existingByGroup = new Map<string, string>();
  for (const { data: existing, error: existingErr } of existingResults) {
    if (existingErr) {
      console.error("[shareImportedRows] existing-group lookup failed:", existingErr.message);
      result.errors.push("Reparto de cuotas: no se pudo verificar qué compras ya estaban compartidas.");
      return result;
    }
    for (const d of existing ?? []) {
      if (d.installment_group_id && d.split_group_id && !existingByGroup.has(d.installment_group_id)) {
        existingByGroup.set(d.installment_group_id, d.split_group_id);
      }
    }
  }

  for (const [groupId, groupRows] of byGroup) {
    const sorted = [...groupRows].sort(
      (a, b) => (a.installment_current ?? 0) - (b.installment_current ?? 0) || (a.transaction_date < b.transaction_date ? -1 : 1),
    );
    const anchor = sorted[0];
    const ids = sorted.map((r) => r.transactionId);
    const existingSplit = existingByGroup.get(groupId);
    // One purchase, one split: if two cuotas of it carry different people or
    // percentages, the lowest cuota wins and the user is told.
    const anchorConfig = JSON.stringify({ m: anchor.share.method, u: anchor.share.userIncluded, p: anchor.share.participants });
    if (
      sorted.some(
        (r) => JSON.stringify({ m: r.share.method, u: r.share.userIncluded, p: r.share.participants }) !== anchorConfig,
      )
    ) {
      result.notes.push(
        `Reparto: ${anchor.raw_description}: se usó el reparto de la cuota ${anchor.installment_current ?? 1} para toda la compra.`,
      );
    }

    if (existingSplit) {
      // Purchase already shared: these cuotas join the group, no new debts.
      const { error } = await supabase
        .from("transactions")
        .update({ split_group_id: existingSplit, split_repaid_amount: 0 })
        .eq("user_id", userId)
        .in("id", ids);
      if (error) {
        console.error("[shareImportedRows] link cuota failed:", error.message);
        result.errors.push(`Reparto: ${anchor.raw_description}: no se pudo vincular la cuota a la compra compartida.`);
        continue;
      }
      try {
        await recomputeSplitRepaid(supabase, userId, existingSplit);
      } catch (e) {
        console.error("[shareImportedRows] recompute failed:", e);
        result.errors.push(`Reparto: ${anchor.raw_description}: cuota vinculada, pero no se recalculó lo devuelto.`);
      }
      result.installmentLinkedCount += ids.length;
      continue;
    }

    const n = anchor.installment_total ?? sorted.length;
    const decimals = getCurrencyDecimals(anchor.currency_code as CurrencyCode);
    // With the purchase price we estimate the interest on top. Without it the
    // only figure is the cuota, which already carries that month's interest:
    // cuota × N is the total, never a principal to add interest to again.
    let plan: InstallmentPlan;
    if (anchor.original_amount != null && anchor.original_amount > 0) {
      plan = estimateInstallmentPlan({
        principal: anchor.original_amount,
        installmentTotal: n,
        eaRatePercent: anchor.share.ea_rate_percent ?? null,
        decimals,
      });
      if (!plan.interestKnown) {
        result.notes.push(`Cuota sin tasa: ${anchor.raw_description} — se repartió sin interés estimado.`);
      }
    } else {
      const total = Math.round(anchor.amount * n * 100) / 100;
      plan = { principal: total, installmentTotal: n, monthlyRate: 0, monthlyPayment: anchor.amount, totalInterest: 0, totalCost: total, interestKnown: false };
      result.notes.push(`Cuota sin precio: ${anchor.raw_description} — se repartió cuota × ${n}, sin interés aparte.`);
    }
    if (plan.totalCost <= 0) {
      result.errors.push(`Reparto: ${anchor.raw_description}: no se pudo calcular el total de la compra a cuotas.`);
      continue;
    }
    const res = await splitExistingTransaction(
      supabase,
      userId,
      { id: anchor.transactionId, amount: anchor.amount, currency_code: anchor.currency_code },
      toConfig(anchor, `${anchor.raw_description} · ${n} cuotas`),
      {
        total: plan.totalCost,
        extraTransactionIds: ids.slice(1),
        debtExtras: { installment_group_id: groupId, installment_total: n, group_total_amount: plan.totalCost },
        interestShareRatio: plan.totalCost > 0 ? plan.totalInterest / plan.totalCost : 0,
      },
    ).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Error inesperado" }));
    if (res.ok) {
      result.sharedCount += 1;
      // Later cuotas already on file (e.g. shared from the trip page after the
      // fact) are not in this import; nothing else to stamp here.
    } else {
      result.errors.push(`Reparto: ${anchor.raw_description}: ${res.error}`);
    }
  }
  return result;
}
