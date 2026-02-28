"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { autoCategorize } from "@venti5/shared";
import { previewImportReconciliation } from "@/actions/import-transactions";
import { Button } from "@/components/ui/button";
import { ParsedTransactionTable } from "./parsed-transaction-table";
import { formatCurrency } from "@/lib/utils/currency";
import { computeInstallmentGroupId } from "@/lib/utils/idempotency";
import { trackClientEvent } from "@/lib/utils/analytics";
import type { CurrencyCode, CategoryWithChildren } from "@/types/domain";
import type {
  ParseResponse,
  ReconciliationPreviewResult,
  StatementAccountMapping,
  StatementMetaForImport,
  TransactionToImport,
} from "@/types/import";

export function StepConfirm({
  parseResult,
  mappings,
  categories,
  onContinue,
  onBack,
}: {
  parseResult: ParseResponse;
  mappings: StatementAccountMapping[];
  categories: CategoryWithChildren[];
  onContinue: (payload: {
    transactions: TransactionToImport[];
    statementMeta: StatementMetaForImport[];
    reconciliationPreview: ReconciliationPreviewResult;
  }) => void;
  onBack: () => void;
}) {
  const [selections, setSelections] = useState<Map<number, Set<number>>>(() => {
    const initial = new Map<number, Set<number>>();
    parseResult.statements.forEach((stmt, idx) => {
      initial.set(idx, new Set(stmt.transactions.map((_, i) => i)));
    });
    return initial;
  });
  const [categoryOverrides, setCategoryOverrides] = useState<Map<string, string | null>>(() => {
    const map = new Map<string, string | null>();
    parseResult.statements.forEach((stmt, stmtIdx) => {
      stmt.transactions.forEach((tx, txIdx) => {
        const result = autoCategorize(tx.description);
        if (result) map.set(`${stmtIdx}-${txIdx}`, result.category_id);
      });
    });
    return map;
  });
  const [loadingPreview, setLoadingPreview] = useState(false);

  const autoCategorizedCount = useMemo(() => categoryOverrides.size, [categoryOverrides]);

  function getCategoryForTx(stmtIdx: number, txIdx: number): string | null {
    return categoryOverrides.get(`${stmtIdx}-${txIdx}`) ?? null;
  }

  function setCategoryForTx(stmtIdx: number, txIdx: number, categoryId: string | null) {
    setCategoryOverrides((prev) => {
      const next = new Map(prev);
      if (categoryId) next.set(`${stmtIdx}-${txIdx}`, categoryId);
      else next.delete(`${stmtIdx}-${txIdx}`);
      return next;
    });
  }

  function toggleTransaction(stmtIdx: number, txIdx: number) {
    setSelections((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(stmtIdx) ?? []);
      if (set.has(txIdx)) set.delete(txIdx);
      else set.add(txIdx);
      next.set(stmtIdx, set);
      return next;
    });
  }

  function toggleAllForStatement(stmtIdx: number) {
    setSelections((prev) => {
      const next = new Map(prev);
      const current = next.get(stmtIdx) ?? new Set();
      const total = parseResult.statements[stmtIdx].transactions.length;
      if (current.size === total) next.set(stmtIdx, new Set());
      else next.set(stmtIdx, new Set(Array.from({ length: total }, (_, i) => i)));
      return next;
    });
  }

  function buildTotals() {
    let count = 0;
    const byCurrency: Record<string, number> = {};
    parseResult.statements.forEach((stmt, idx) => {
      const sel = selections.get(idx) ?? new Set();
      sel.forEach((txIdx) => {
        const tx = stmt.transactions[txIdx];
        count++;
        byCurrency[stmt.currency] = (byCurrency[stmt.currency] ?? 0) + tx.amount;
      });
    });
    return { count, byCurrency };
  }

  async function buildTransactions(): Promise<TransactionToImport[]> {
    const txs: TransactionToImport[] = [];
    for (const [stmtIdx, stmt] of parseResult.statements.entries()) {
      const mapping = mappings.find((m) => m.statementIndex === stmtIdx);
      if (!mapping) continue;
      const sel = selections.get(stmtIdx) ?? new Set();
      for (const txIdx of sel) {
        const tx = stmt.transactions[txIdx];
        const categoryId = getCategoryForTx(stmtIdx, txIdx);
        const autoResult = autoCategorize(tx.description);
        const wasAutoAssigned = autoResult?.category_id === categoryId;

        let installmentGroupId: string | null = null;
        if (tx.installment_current != null && tx.installment_total != null) {
          installmentGroupId = await computeInstallmentGroupId({
            accountId: mapping.accountId,
            rawDescription: tx.description,
            amount: tx.amount,
          });
        }

        txs.push({
          import_key: `${stmtIdx}:${txIdx}`,
          account_id: mapping.accountId,
          amount: tx.amount,
          currency_code: stmt.currency,
          direction: tx.direction,
          transaction_date: tx.date,
          raw_description: tx.description,
          category_id: categoryId,
          categorization_source: categoryId
            ? wasAutoAssigned
              ? "SYSTEM_DEFAULT"
              : "USER_OVERRIDE"
            : undefined,
          categorization_confidence: categoryId && wasAutoAssigned ? 0.7 : null,
          installment_current: tx.installment_current,
          installment_total: tx.installment_total,
          installment_group_id: installmentGroupId,
        });
      }
    }
    return txs;
  }

  function buildStatementMeta(): StatementMetaForImport[] {
    return parseResult.statements
      .map((stmt, stmtIdx) => {
        const mapping = mappings.find((m) => m.statementIndex === stmtIdx);
        if (!mapping?.accountId) return null;
        return {
          accountId: mapping.accountId,
          statementIndex: stmtIdx,
          summary: stmt.summary,
          creditCardMetadata: stmt.credit_card_metadata,
          loanMetadata: stmt.loan_metadata,
          periodFrom: stmt.period_from,
          periodTo: stmt.period_to,
          currency: stmt.currency,
          transactionCount: stmt.transactions.length,
        };
      })
      .filter((value): value is StatementMetaForImport => value !== null);
  }

  async function handleContinue() {
    setLoadingPreview(true);
    try {
      const transactions = await buildTransactions();
      const preview = await previewImportReconciliation(
        transactions.map((item) => {
          const [statementIndex, transactionIndex] = (item.import_key ?? "0:0")
            .split(":")
            .map(Number);
          return {
            statementIndex,
            transactionIndex,
            importedTransaction: item,
          };
        })
      );
      await trackClientEvent({
        event_name: "reconciliation_started",
        flow: "import",
        step: "reconciliation_preview",
        entry_point: "cta",
        success: true,
        metadata: {
          matches_auto: preview.autoMerge.length,
          matches_review: preview.review.length,
          matches_rejected: 0,
        },
      });
      onContinue({
        transactions,
        statementMeta: buildStatementMeta(),
        reconciliationPreview: preview,
      });
    } finally {
      setLoadingPreview(false);
    }
  }

  const totals = buildTotals();

  return (
    <div className="space-y-6">
      {autoCategorizedCount > 0 && (
        <div className="rounded-md bg-blue-500/10 p-3 text-sm text-blue-700">
          Se categorizaron automáticamente {autoCategorizedCount} transacciones.
          Puedes cambiarlas antes de reconciliar e importar.
        </div>
      )}

      {parseResult.statements.map((stmt, stmtIdx) => {
        const mapping = mappings.find((m) => m.statementIndex === stmtIdx);
        const sel = selections.get(stmtIdx) ?? new Set();

        return (
          <div key={stmtIdx} className="space-y-2">
            <h3 className="text-sm font-medium">
              {stmt.bank} — {stmt.currency}
              {mapping && stmt.transactions.length > 0 && (
                <span className="ml-2 font-normal text-muted-foreground">
                  ({sel.size} de {stmt.transactions.length} seleccionadas)
                </span>
              )}
            </h3>
            {stmt.transactions.length > 0 ? (
              <ParsedTransactionTable
                transactions={stmt.transactions}
                currency={stmt.currency}
                selected={sel}
                onToggle={(txIdx) => toggleTransaction(stmtIdx, txIdx)}
                onToggleAll={() => toggleAllForStatement(stmtIdx)}
                categories={categories}
                categoryMap={categoryOverrides}
                stmtIdx={stmtIdx}
                onCategoryChange={(txIdx, catId) => setCategoryForTx(stmtIdx, txIdx, catId)}
              />
            ) : (
              <div className="rounded-md border bg-muted/50 p-4 text-sm text-muted-foreground">
                Este extracto no contiene transacciones. Se importarán solo metadatos de la cuenta.
              </div>
            )}
          </div>
        );
      })}

      <div className="flex items-center justify-between rounded-md border bg-muted/50 p-3 text-sm">
        <span>
          <strong>{totals.count}</strong> transacciones seleccionadas
        </span>
        <div className="flex gap-3">
          {Object.entries(totals.byCurrency).map(([cur, amount]) => (
            <span key={cur} className="text-muted-foreground">
              {formatCurrency(amount, cur as CurrencyCode)}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          Volver
        </Button>
        <Button type="button" onClick={handleContinue} disabled={loadingPreview}>
          {loadingPreview ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analizando duplicados...
            </>
          ) : totals.count > 0 ? (
            "Continuar a reconciliación"
          ) : (
            "Importar solo metadatos"
          )}
        </Button>
      </div>
    </div>
  );
}
