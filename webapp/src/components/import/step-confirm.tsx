"use client";

import { useState, useActionState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ParsedTransactionTable } from "./parsed-transaction-table";
import { importTransactions } from "@/actions/import-transactions";
import { formatCurrency } from "@/lib/utils/currency";
import { autoCategorize } from "@/lib/utils/auto-categorize";
import type { CurrencyCode, CategoryWithChildren } from "@/types/domain";
import type { ActionResult } from "@/types/actions";
import type {
  ParseResponse,
  StatementAccountMapping,
  ImportResult,
  TransactionToImport,
  StatementMetaForImport,
} from "@/types/import";

export function StepConfirm({
  parseResult,
  mappings,
  categories,
  onComplete,
  onBack,
}: {
  parseResult: ParseResponse;
  mappings: StatementAccountMapping[];
  categories: CategoryWithChildren[];
  onComplete: (result: ImportResult) => void;
  onBack: () => void;
}) {
  // Track selected transactions per statement: Map<statementIndex, Set<txIndex>>
  const [selections, setSelections] = useState<Map<number, Set<number>>>(() => {
    const initial = new Map<number, Set<number>>();
    parseResult.statements.forEach((stmt, idx) => {
      initial.set(idx, new Set(stmt.transactions.map((_, i) => i)));
    });
    return initial;
  });

  // Auto-categorize on mount: Map<"stmtIdx-txIdx", categoryId>
  const [categoryOverrides, setCategoryOverrides] = useState<
    Map<string, string | null>
  >(() => {
    const map = new Map<string, string | null>();
    parseResult.statements.forEach((stmt, stmtIdx) => {
      stmt.transactions.forEach((tx, txIdx) => {
        const result = autoCategorize(tx.description);
        if (result) {
          map.set(`${stmtIdx}-${txIdx}`, result.category_id);
        }
      });
    });
    return map;
  });

  // Count how many were auto-categorized
  const autoCategorizedCount = useMemo(
    () => categoryOverrides.size,
    [categoryOverrides]
  );

  function getCategoryForTx(stmtIdx: number, txIdx: number): string | null {
    return categoryOverrides.get(`${stmtIdx}-${txIdx}`) ?? null;
  }

  function setCategoryForTx(
    stmtIdx: number,
    txIdx: number,
    categoryId: string | null
  ) {
    setCategoryOverrides((prev) => {
      const next = new Map(prev);
      if (categoryId) {
        next.set(`${stmtIdx}-${txIdx}`, categoryId);
      } else {
        next.delete(`${stmtIdx}-${txIdx}`);
      }
      return next;
    });
  }

  function toggleTransaction(stmtIdx: number, txIdx: number) {
    setSelections((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(stmtIdx) ?? []);
      if (set.has(txIdx)) {
        set.delete(txIdx);
      } else {
        set.add(txIdx);
      }
      next.set(stmtIdx, set);
      return next;
    });
  }

  function toggleAllForStatement(stmtIdx: number) {
    setSelections((prev) => {
      const next = new Map(prev);
      const current = next.get(stmtIdx) ?? new Set();
      const total = parseResult.statements[stmtIdx].transactions.length;
      if (current.size === total) {
        next.set(stmtIdx, new Set());
      } else {
        next.set(stmtIdx, new Set(Array.from({ length: total }, (_, i) => i)));
      }
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

  const totals = buildTotals();

  function buildPayload(): TransactionToImport[] {
    const txs: TransactionToImport[] = [];
    parseResult.statements.forEach((stmt, stmtIdx) => {
      const mapping = mappings.find((m) => m.statementIndex === stmtIdx);
      if (!mapping) return;
      const sel = selections.get(stmtIdx) ?? new Set();
      sel.forEach((txIdx) => {
        const tx = stmt.transactions[txIdx];
        const categoryId = getCategoryForTx(stmtIdx, txIdx);
        const autoResult = autoCategorize(tx.description);
        const wasAutoAssigned = autoResult?.category_id === categoryId;

        txs.push({
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
        });
      });
    });
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
          periodFrom: stmt.period_from,
          periodTo: stmt.period_to,
          currency: stmt.currency,
          transactionCount: stmt.transactions.length,
        };
      })
      .filter((m): m is StatementMetaForImport => m !== null);
  }

  const [state, formAction, pending] = useActionState<
    ActionResult<ImportResult>,
    FormData
  >(
    async (prevState, formData) => {
      const result = await importTransactions(prevState, formData);
      if (result.success) {
        onComplete(result.data);
      }
      return result;
    },
    { success: false, error: "" }
  );

  return (
    <div className="space-y-6">
      {!state.success && state.error && (
        <div className="bg-destructive/10 text-destructive text-sm rounded-md p-3">
          {state.error}
        </div>
      )}

      {autoCategorizedCount > 0 && (
        <div className="bg-blue-500/10 text-blue-700 text-sm rounded-md p-3">
          Se categorizaron automáticamente {autoCategorizedCount} transacciones.
          Puedes cambiar la categoría en la columna &quot;Categoría&quot;.
        </div>
      )}

      {parseResult.statements.map((stmt, stmtIdx) => {
        const mapping = mappings.find((m) => m.statementIndex === stmtIdx);
        const sel = selections.get(stmtIdx) ?? new Set();

        return (
          <div key={stmtIdx} className="space-y-2">
            <h3 className="text-sm font-medium">
              {stmt.bank} — {stmt.currency}
              {mapping && (
                <span className="text-muted-foreground font-normal ml-2">
                  ({sel.size} de {stmt.transactions.length} seleccionadas)
                </span>
              )}
            </h3>
            <ParsedTransactionTable
              transactions={stmt.transactions}
              currency={stmt.currency}
              selected={sel}
              onToggle={(txIdx) => toggleTransaction(stmtIdx, txIdx)}
              onToggleAll={() => toggleAllForStatement(stmtIdx)}
              categories={categories}
              categoryMap={categoryOverrides}
              stmtIdx={stmtIdx}
              onCategoryChange={(txIdx, catId) =>
                setCategoryForTx(stmtIdx, txIdx, catId)
              }
            />
          </div>
        );
      })}

      {/* Summary bar */}
      <div className="flex items-center justify-between rounded-md border bg-muted/50 p-3 text-sm">
        <span>
          <strong>{totals.count}</strong> transacciones seleccionadas
        </span>
        <div className="flex gap-3">
          {Object.entries(totals.byCurrency).map(([cur, amount]) => (
            <span key={cur} className="font-medium">
              {formatCurrency(amount, cur as CurrencyCode)}
            </span>
          ))}
        </div>
      </div>

      <form action={formAction}>
        <input
          type="hidden"
          name="payload"
          value={JSON.stringify({
            transactions: buildPayload(),
            statementMeta: buildStatementMeta(),
          })}
        />
        <div className="flex items-center gap-3">
          <Button variant="outline" type="button" onClick={onBack}>
            Volver
          </Button>
          <Button type="submit" disabled={pending || totals.count === 0}>
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              `Importar ${totals.count} transacciones`
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
