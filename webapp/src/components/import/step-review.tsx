"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import {
  matchDestinatario,
  prepareDestinatarioRules,
  type DestinatarioRule,
} from "@zeta/shared";
import { previewImportReconciliation } from "@/actions/import-transactions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionDivider } from "./section-divider";
import { CreditCardSummary } from "./credit-card-summary";
import { CreditCardStackCard } from "./credit-card-stack-card";
import { StatementSummaryCard } from "./statement-summary-card";
import { CreateAccountDialog } from "./create-account-dialog";
import { ParsedTransactionTable } from "./parsed-transaction-table";
import { AccountAssignControl } from "./account-assign-control";
import { WizardActionBar } from "./wizard-action-bar";
import { DestinatarioCreateDialog } from "@/components/destinatarios/destinatario-create-form";
import { useCategories } from "@/components/providers/app-data-provider";
import { computeInstallmentGroupId } from "@/lib/utils/idempotency";
import { trackClientEvent } from "@/lib/utils/analytics";
import { cn } from "@/lib/utils";
import type { Account, CurrencyCode } from "@/types/domain";
import type {
  ParseResponse,
  ReconciliationPreviewResult,
  StatementAccountMapping,
  StatementMetaForImport,
  TransactionToImport,
} from "@/types/import";

type ContinuePayload = {
  transactions: TransactionToImport[];
  statementMeta: StatementMetaForImport[];
  reconciliationPreview: ReconciliationPreviewResult;
};

type Props = {
  parseResult: ParseResponse;
  accounts: Account[];
  mappings: StatementAccountMapping[];
  destinatarioRules: DestinatarioRule[];
  onMappingsChange: (mappings: StatementAccountMapping[]) => void;
  onContinue: (payload: ContinuePayload) => void;
  onBack: () => void;
  onAccountCreated: (account: Account) => void;
};

export function StepReview({
  parseResult,
  accounts,
  mappings,
  destinatarioRules,
  onMappingsChange,
  onContinue,
  onBack,
  onAccountCreated,
}: Props) {
  const [localMappings, setLocalMappings] = useState<StatementAccountMapping[]>(mappings);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogStatementIndex, setDialogStatementIndex] = useState(0);
  const [expandedStatement, setExpandedStatement] = useState<number | null>(null);
  const [preparing, setPreparing] = useState(false);

  const [selections, setSelections] = useState<Map<number, Set<number>>>(() => {
    const initial = new Map<number, Set<number>>();
    parseResult.statements.forEach((stmt, idx) => {
      initial.set(idx, new Set(stmt.transactions.map((_, i) => i)));
    });
    return initial;
  });

  const categories = useCategories();
  // Destinatarios created during review (keyed `${stmtIdx}-${txIdx}`). These
  // override the page-loaded auto-match, which can't know about new ones.
  const [destOverrides, setDestOverrides] = useState<
    Map<string, { id: string; name: string }>
  >(new Map());
  // Category from a destinatario created in-review (its default_category_id),
  // so the imported row gets categorized — the auto-match catMap can't know it.
  const [catOverrides, setCatOverrides] = useState<Map<string, string | null>>(
    new Map(),
  );
  const [destDialogTarget, setDestDialogTarget] = useState<{
    stmtIdx: number;
    txIdx: number;
  } | null>(null);

  const { destMap, catMap } = useMemo(() => {
    const prepared = prepareDestinatarioRules(destinatarioRules);
    const dest = new Map<string, { id: string; name: string }>();
    const cat = new Map<string, string | null>();
    parseResult.statements.forEach((stmt, stmtIdx) => {
      stmt.transactions.forEach((tx, txIdx) => {
        const match = matchDestinatario(tx.description, prepared);
        if (match) {
          const key = `${stmtIdx}-${txIdx}`;
          dest.set(key, { id: match.destinatario_id, name: match.destinatario_name });
          if (match.category_id) cat.set(key, match.category_id);
        }
      });
    });
    return { destMap: dest, catMap: cat };
  }, [parseResult, destinatarioRules]);

  // Auto-match + in-review overrides combined; overrides win.
  const mergedDestMap = useMemo(() => {
    if (destOverrides.size === 0) return destMap;
    const merged = new Map(destMap);
    for (const [key, value] of destOverrides) merged.set(key, value);
    return merged;
  }, [destMap, destOverrides]);

  const mergedCatMap = useMemo(() => {
    if (catOverrides.size === 0) return catMap;
    const merged = new Map(catMap);
    for (const [key, value] of catOverrides) merged.set(key, value);
    return merged;
  }, [catMap, catOverrides]);

  function openDestDialog(stmtIdx: number, txIdx: number) {
    setDestDialogTarget({ stmtIdx, txIdx });
  }

  function handleDestinatarioCreated(dest: {
    id: string;
    name: string;
    defaultCategoryId: string | null;
  }) {
    if (!destDialogTarget) return;
    const key = `${destDialogTarget.stmtIdx}-${destDialogTarget.txIdx}`;
    setDestOverrides((prev) =>
      new Map(prev).set(key, { id: dest.id, name: dest.name }),
    );
    // Apply the destinatario's default category to this row if it has one and
    // the row isn't already categorized by auto-match.
    if (dest.defaultCategoryId && !catMap.get(key)) {
      setCatOverrides((prev) => new Map(prev).set(key, dest.defaultCategoryId));
    }
    setDestDialogTarget(null);
  }

  const [prevMappings, setPrevMappings] = useState(mappings);
  if (mappings !== prevMappings) {
    setPrevMappings(mappings);
    setLocalMappings((local) =>
      mappings.map((m) => {
        const entry = local.find((l) => l.statementIndex === m.statementIndex);
        if (m.autoMatched && entry && !entry.accountId) return m;
        if (entry && entry.accountId && !entry.autoMatched) return entry;
        return m;
      }),
    );
  }

  // Multi-CC detection: all statements are credit_card with metadata.
  // Switch to compact stack cards instead of one hero summary per statement.
  const allCreditCard =
    parseResult.statements.length > 1 &&
    parseResult.statements.every(
      (s) => s.statement_type === "credit_card" && s.credit_card_metadata != null,
    );

  function updateMapping(index: number, accountId: string) {
    setLocalMappings((prev) => {
      const next = prev.map((m) =>
        m.statementIndex === index ? { ...m, accountId, autoMatched: false } : m,
      );
      onMappingsChange(next);
      return next;
    });
  }

  function updatePrimaryCurrency(accountId: string, currency: string) {
    setLocalMappings((prev) => {
      const next = prev.map((m) =>
        m.accountId === accountId ? { ...m, primaryCurrency: currency } : m,
      );
      onMappingsChange(next);
      return next;
    });
  }

  function getCurrenciesForAccount(accountId: string): string[] {
    const currencies = new Set<string>();
    localMappings.forEach((m) => {
      if (m.accountId === accountId) {
        const stmt = parseResult.statements[m.statementIndex];
        if (stmt) currencies.add(stmt.currency);
      }
    });
    return Array.from(currencies);
  }

  function getDefaultPrimaryCurrency(accountId: string): string {
    let best = "";
    let bestCount = -1;
    localMappings.forEach((m) => {
      if (m.accountId !== accountId) return;
      const stmt = parseResult.statements[m.statementIndex];
      if (!stmt) return;
      const count = stmt.transactions.length;
      if (stmt.currency === "COP" || count > bestCount) {
        if (best !== "COP") {
          best = stmt.currency;
          bestCount = count;
        }
      }
    });
    return best;
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

  function openCreateDialog(stmtIndex: number) {
    setDialogStatementIndex(stmtIndex);
    setDialogOpen(true);
  }

  function handleAccountCreated(account: Account) {
    onAccountCreated(account);
    updateMapping(dialogStatementIndex, account.id);
  }

  async function buildTransactions(): Promise<TransactionToImport[]> {
    // Collect the rows first so installment hashes can resolve in parallel.
    type Row = {
      stmtIdx: number;
      txIdx: number;
      accountId: string;
      stmt: (typeof parseResult.statements)[number];
      tx: (typeof parseResult.statements)[number]["transactions"][number];
    };
    const rows: Row[] = [];
    for (const [stmtIdx, stmt] of parseResult.statements.entries()) {
      const mapping = localMappings.find((m) => m.statementIndex === stmtIdx);
      if (!mapping?.accountId) continue;
      const sel = selections.get(stmtIdx) ?? new Set();
      for (const txIdx of sel) {
        rows.push({ stmtIdx, txIdx, accountId: mapping.accountId, stmt, tx: stmt.transactions[txIdx] });
      }
    }

    const installmentIds = await Promise.all(
      rows.map((row) =>
        row.tx.installment_current != null && row.tx.installment_total != null
          ? computeInstallmentGroupId({
              accountId: row.accountId,
              rawDescription: row.tx.description,
              amount: row.tx.original_amount ?? row.tx.amount,
            })
          : Promise.resolve<string | null>(null),
      ),
    );

    return rows.map((row, i) => {
      const key = `${row.stmtIdx}-${row.txIdx}`;
      const categoryId = mergedCatMap.get(key) ?? null;
      const destMatch = mergedDestMap.get(key);
      const destinatarioId = destMatch?.id ?? null;
      const merchantName = destMatch?.name ?? null;

      return {
        import_key: `${row.stmtIdx}:${row.txIdx}`,
        account_id: row.accountId,
        amount: row.tx.amount,
        currency_code: row.stmt.currency,
        direction: row.tx.direction,
        transaction_date: row.tx.date,
        raw_description: row.tx.description,
        category_id: categoryId,
        categorization_source: categoryId
          ? destinatarioId
            ? "USER_LEARNED"
            : "USER_OVERRIDE"
          : undefined,
        categorization_confidence: categoryId && destinatarioId ? 0.8 : null,
        installment_current: row.tx.installment_current,
        installment_total: row.tx.installment_total,
        installment_group_id: installmentIds[i],
        original_amount: row.tx.original_amount,
        destinatario_id: destinatarioId,
        merchant_name: merchantName,
      };
    });
  }

  function buildStatementMeta(): StatementMetaForImport[] {
    const result: StatementMetaForImport[] = [];
    parseResult.statements.forEach((stmt, stmtIdx) => {
      const mapping = localMappings.find((m) => m.statementIndex === stmtIdx);
      if (!mapping?.accountId) return;
      result.push({
        accountId: mapping.accountId,
        statementIndex: stmtIdx,
        summary: stmt.summary,
        creditCardMetadata: stmt.credit_card_metadata,
        loanMetadata: stmt.loan_metadata,
        periodFrom: stmt.period_from,
        periodTo: stmt.period_to,
        currency: stmt.currency,
        transactionCount: stmt.transactions.length,
        primaryCurrency: mapping.primaryCurrency,
      });
    });
    return result;
  }

  async function handleContinue() {
    setPreparing(true);
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
        }),
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
      setPreparing(false);
    }
  }

  const allMapped = localMappings.every((m) => m.accountId !== "");
  const totalSelected = Array.from(selections.values()).reduce(
    (acc, s) => acc + s.size,
    0,
  );

  // Track rendered currency selectors so we only show one per account.
  const renderedCurrencySelector = new Set<string>();

  return (
    <div className="space-y-6">
      {allCreditCard ? (
        <MultiCreditCardGroup
          statements={parseResult.statements}
          mappings={localMappings}
          accounts={accounts}
          selections={selections}
          onSelectAccount={(accountId) => {
            parseResult.statements.forEach((_, idx) => updateMapping(idx, accountId));
          }}
          onCreateAccount={() => openCreateDialog(0)}
          onUpdatePrimaryCurrency={updatePrimaryCurrency}
          getDefaultPrimaryCurrency={getDefaultPrimaryCurrency}
          getCurrenciesForAccount={getCurrenciesForAccount}
          onToggleTransaction={toggleTransaction}
          onToggleAll={toggleAllForStatement}
          expandedStatement={expandedStatement}
          onToggleExpanded={(idx) =>
            setExpandedStatement((p) => (p === idx ? null : idx))
          }
          destinatarioMap={mergedDestMap}
          onCreateDestinatario={openDestDialog}
        />
      ) : (
        parseResult.statements.map((stmt, idx) => {
          const mapping = localMappings.find((m) => m.statementIndex === idx);
          const accountId = mapping?.accountId ?? "";
          const isCreditCard =
            stmt.statement_type === "credit_card" && stmt.credit_card_metadata != null;
          const isLoan = stmt.statement_type === "loan" && stmt.loan_metadata != null;

          let showCurrencySelector = false;
          if (accountId && !renderedCurrencySelector.has(accountId)) {
            const currencies = getCurrenciesForAccount(accountId);
            if (currencies.length > 1) {
              showCurrencySelector = true;
              renderedCurrencySelector.add(accountId);
            }
          }
          const primaryCurrency =
            mapping?.primaryCurrency ?? getDefaultPrimaryCurrency(accountId);
          const accountCurrencies = accountId
            ? getCurrenciesForAccount(accountId)
            : [];

          return (
            <StatementBlock
              key={idx}
              stmt={stmt}
              accounts={accounts}
              accountId={accountId}
              autoMatched={mapping?.autoMatched}
              onSelectAccount={(id) => updateMapping(idx, id)}
              onCreateAccount={() => openCreateDialog(idx)}
              isCreditCard={isCreditCard}
              isLoan={isLoan}
              selections={selections.get(idx) ?? new Set()}
              onToggleTransaction={(txIdx) => toggleTransaction(idx, txIdx)}
              onToggleAll={() => toggleAllForStatement(idx)}
              expanded={expandedStatement === idx}
              onToggleExpanded={() =>
                setExpandedStatement((p) => (p === idx ? null : idx))
              }
              showCurrencySelector={showCurrencySelector}
              currencies={accountCurrencies}
              primaryCurrency={primaryCurrency}
              onPrimaryCurrencyChange={(c) => updatePrimaryCurrency(accountId, c)}
              stmtIdx={idx}
              destinatarioMap={mergedDestMap}
              onCreateDestinatario={(txIdx) => openDestDialog(idx, txIdx)}
            />
          );
        })
      )}

      <CreateAccountDialog
        statement={parseResult.statements[dialogStatementIndex]}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleAccountCreated}
      />

      {destDialogTarget &&
        (() => {
          const stmt = parseResult.statements[destDialogTarget.stmtIdx];
          const tx = stmt?.transactions[destDialogTarget.txIdx];
          if (!tx) return null;
          return (
            <DestinatarioCreateDialog
              key={`${destDialogTarget.stmtIdx}-${destDialogTarget.txIdx}`}
              open
              onOpenChange={(o) => {
                if (!o) setDestDialogTarget(null);
              }}
              categories={categories}
              rawDescription={tx.description}
              amount={tx.original_amount ?? tx.amount}
              currencyCode={stmt.currency as CurrencyCode}
              onCreated={handleDestinatarioCreated}
              onCancel={() => setDestDialogTarget(null)}
            />
          );
        })()}

      <WizardActionBar>
        <Button variant="outline" onClick={onBack}>
          Volver
        </Button>
        <Button onClick={handleContinue} disabled={!allMapped || preparing}>
          {preparing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analizando...
            </>
          ) : (
            `Continuar · ${totalSelected} ${totalSelected === 1 ? "movimiento" : "movimientos"}`
          )}
        </Button>
      </WizardActionBar>
    </div>
  );
}

function UnifiedStatementCard({
  accounts,
  accountId,
  autoMatched,
  onSelectAccount,
  onCreateAccount,
  showCurrencySelector,
  currencies,
  primaryCurrency,
  onPrimaryCurrencyChange,
}: {
  accounts: Account[];
  accountId: string;
  autoMatched?: boolean;
  onSelectAccount: (id: string) => void;
  onCreateAccount: () => void;
  showCurrencySelector: boolean;
  currencies: string[];
  primaryCurrency: string;
  onPrimaryCurrencyChange: (c: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <AccountAssignControl
          accounts={accounts}
          accountId={accountId}
          autoMatched={autoMatched}
          onSelect={onSelectAccount}
          onCreate={onCreateAccount}
          variant="pill"
        />
      </div>
      {showCurrencySelector && currencies.length > 1 && (
        <Select value={primaryCurrency} onValueChange={onPrimaryCurrencyChange}>
          <SelectTrigger className="h-9 w-auto shrink-0 gap-1 rounded-full border-z-brass/30 bg-z-brass/12 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-z-brass">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {currencies.map((cur) => (
              <SelectItem key={cur} value={cur} className="text-xs">
                {cur}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function StatementBlock({
  stmt,
  accounts,
  accountId,
  autoMatched,
  onSelectAccount,
  onCreateAccount,
  isCreditCard,
  isLoan,
  selections,
  onToggleTransaction,
  onToggleAll,
  expanded,
  onToggleExpanded,
  showCurrencySelector,
  currencies,
  primaryCurrency,
  onPrimaryCurrencyChange,
  stmtIdx,
  destinatarioMap,
  onCreateDestinatario,
}: {
  stmt: ParseResponse["statements"][number];
  accounts: Account[];
  accountId: string;
  autoMatched?: boolean;
  onSelectAccount: (id: string) => void;
  onCreateAccount: () => void;
  isCreditCard: boolean;
  isLoan: boolean;
  selections: Set<number>;
  onToggleTransaction: (txIdx: number) => void;
  onToggleAll: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  showCurrencySelector: boolean;
  currencies: string[];
  primaryCurrency: string;
  onPrimaryCurrencyChange: (c: string) => void;
  stmtIdx: number;
  destinatarioMap: Map<string, { id: string; name: string }>;
  onCreateDestinatario: (txIdx: number) => void;
}) {
  return (
    <div className="space-y-3">
      <UnifiedStatementCard
        accounts={accounts}
        accountId={accountId}
        autoMatched={autoMatched}
        onSelectAccount={onSelectAccount}
        onCreateAccount={onCreateAccount}
        showCurrencySelector={showCurrencySelector}
        currencies={currencies}
        primaryCurrency={primaryCurrency}
        onPrimaryCurrencyChange={onPrimaryCurrencyChange}
      />

      {isCreditCard && stmt.credit_card_metadata ? (
        <>
          <SectionDivider label="Por pagar" />
          <CreditCardSummary
            metadata={stmt.credit_card_metadata}
            summary={stmt.summary ?? null}
            transactionCount={stmt.transactions.length}
            currency={stmt.currency as CurrencyCode}
          />
        </>
      ) : isLoan ? (
        <StatementSummaryCard statement={stmt} />
      ) : null}

      <SectionDivider label="Movimientos" />

      <div className="space-y-2 rounded-2xl border border-white/6 bg-z-surface-2/60 p-3">
        <button
          type="button"
          onClick={onToggleExpanded}
          className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-white/5"
          aria-expanded={expanded}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-z-white">
              {selections.size} de {stmt.transactions.length} seleccionadas
            </p>
            <p className="text-xs text-z-sage-dark">
              {expanded ? "Ocultar detalle" : "Ver y ajustar selección"}
            </p>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-z-sage-dark transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>

        {expanded && stmt.transactions.length > 0 && (
          <ParsedTransactionTable
            transactions={stmt.transactions}
            currency={stmt.currency}
            selected={selections}
            onToggle={onToggleTransaction}
            onToggleAll={onToggleAll}
            stmtIdx={stmtIdx}
            destinatarioMap={destinatarioMap}
            onCreateDestinatario={onCreateDestinatario}
          />
        )}
      </div>
    </div>
  );
}

function MultiCreditCardGroup({
  statements,
  mappings,
  accounts,
  selections,
  onSelectAccount,
  onCreateAccount,
  onUpdatePrimaryCurrency,
  getDefaultPrimaryCurrency,
  getCurrenciesForAccount,
  onToggleTransaction,
  onToggleAll,
  expandedStatement,
  onToggleExpanded,
  destinatarioMap,
  onCreateDestinatario,
}: {
  statements: ParseResponse["statements"];
  mappings: StatementAccountMapping[];
  accounts: Account[];
  selections: Map<number, Set<number>>;
  onSelectAccount: (accountId: string) => void;
  onCreateAccount: () => void;
  onUpdatePrimaryCurrency: (accountId: string, currency: string) => void;
  getDefaultPrimaryCurrency: (accountId: string) => string;
  getCurrenciesForAccount: (accountId: string) => string[];
  onToggleTransaction: (stmtIdx: number, txIdx: number) => void;
  onToggleAll: (stmtIdx: number) => void;
  expandedStatement: number | null;
  onToggleExpanded: (stmtIdx: number) => void;
  destinatarioMap: Map<string, { id: string; name: string }>;
  onCreateDestinatario: (stmtIdx: number, txIdx: number) => void;
}) {
  const firstMapping = mappings[0];
  const accountId = firstMapping?.accountId ?? "";
  const autoMatched = mappings.every((m) => m.autoMatched);
  const primaryCurrency =
    firstMapping?.primaryCurrency ?? getDefaultPrimaryCurrency(accountId);
  const currencies = accountId ? getCurrenciesForAccount(accountId) : [];
  const totalSelected = statements.reduce(
    (sum, _, idx) => sum + (selections.get(idx)?.size ?? 0),
    0,
  );
  const totalTx = statements.reduce((sum, s) => sum + s.transactions.length, 0);

  return (
    <div className="space-y-3">
      <UnifiedStatementCard
        accounts={accounts}
        accountId={accountId}
        autoMatched={autoMatched}
        onSelectAccount={onSelectAccount}
        onCreateAccount={onCreateAccount}
        showCurrencySelector={currencies.length > 1}
        currencies={currencies}
        primaryCurrency={primaryCurrency}
        onPrimaryCurrencyChange={(v) => onUpdatePrimaryCurrency(accountId, v)}
      />

      <SectionDivider label="Por pagar" />
      <div className="space-y-2">
        {statements.map((stmt, i) =>
          stmt.credit_card_metadata ? (
            <CreditCardStackCard
              key={`${stmt.currency}-${i}`}
              currency={stmt.currency as CurrencyCode}
              metadata={stmt.credit_card_metadata}
              summary={stmt.summary ?? null}
              transactionCount={stmt.transactions.length}
            />
          ) : null,
        )}
      </div>

      <SectionDivider label="Movimientos" />
      <div className="space-y-2 rounded-2xl border border-white/6 bg-z-surface-2/60 p-3">
        <div className="px-2 py-1.5">
          <p className="text-sm font-semibold text-z-white">
            {totalSelected} de {totalTx} seleccionadas
          </p>
          <p className="text-xs text-z-sage-dark">
            Expande cada moneda para ajustar su selección.
          </p>
        </div>
        {statements.map((stmt, idx) => {
          const expanded = expandedStatement === idx;
          const sel = selections.get(idx) ?? new Set();
          return (
            <div key={idx} className="rounded-xl border border-white/6 bg-z-surface-3/40">
              <button
                type="button"
                onClick={() => onToggleExpanded(idx)}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-white/5"
                aria-expanded={expanded}
              >
                <span className="flex items-baseline gap-2 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-z-brass">
                    {stmt.currency}
                  </span>
                  <span className="text-xs text-z-sage-light">
                    {sel.size} de {stmt.transactions.length} seleccionadas
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-z-sage-dark transition-transform",
                    expanded && "rotate-180",
                  )}
                />
              </button>
              {expanded && stmt.transactions.length > 0 && (
                <div className="border-t border-white/6 p-2">
                  <ParsedTransactionTable
                    transactions={stmt.transactions}
                    currency={stmt.currency}
                    selected={sel}
                    onToggle={(txIdx) => onToggleTransaction(idx, txIdx)}
                    onToggleAll={() => onToggleAll(idx)}
                    stmtIdx={idx}
                    destinatarioMap={destinatarioMap}
                    onCreateDestinatario={(txIdx) => onCreateDestinatario(idx, txIdx)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
