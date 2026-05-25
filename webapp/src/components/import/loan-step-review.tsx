"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { computeSnapshotDiffs } from "@zeta/shared";
import { importTransactions } from "@/actions/import-transactions";
import {
  getStatementSnapshots,
  type StatementSnapshot,
} from "@/actions/statement-snapshots";
import { Button } from "@/components/ui/button";
import { SectionDivider } from "./section-divider";
import { StatementSummaryCard } from "./statement-summary-card";
import { CreateAccountDialog } from "./create-account-dialog";
import { AccountAssignControl } from "./account-assign-control";
import { WizardActionBar } from "./wizard-action-bar";
import { LoanEvolution } from "./loan-evolution";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import type { ActionResult } from "@/types/actions";
import type { Account, CurrencyCode } from "@/types/domain";
import type {
  ImportResult,
  ParsedStatement,
  ParseResponse,
  StatementAccountMapping,
  StatementMetaForImport,
} from "@/types/import";

// Loan-relevant fields for the month-over-month comparison. interest_rate is
// intentionally omitted: the parsed statement rate may be raw (M.V.) while the
// stored snapshot is normalized to E.A., so diffing them would show a bogus
// rate change in the preview. final_balance is omitted too — for loans it just
// duplicates remaining_balance (Saldo capital).
function buildLoanCurrentSnapshot(
  stmt: ParsedStatement,
): Record<string, number | null> {
  const lm = stmt.loan_metadata;
  return {
    remaining_balance: lm?.remaining_balance ?? null,
    initial_amount: lm?.initial_amount ?? null,
    installments_in_default: lm?.installments_in_default ?? null,
    total_payment_due: lm?.total_payment_due ?? null,
    minimum_payment: lm?.minimum_payment ?? null,
  };
}

// Mirror processStatementMeta: the prior statement is the most recent one whose
// period ends before this statement's period (snapshots come ordered desc).
function findPriorSnapshot(
  snapshots: StatementSnapshot[],
  periodTo: string | null,
): StatementSnapshot | null {
  if (!periodTo) return snapshots[0] ?? null;
  return snapshots.find((s) => s.period_to != null && s.period_to < periodTo) ?? null;
}

type Props = {
  parseResult: ParseResponse;
  accounts: Account[];
  mappings: StatementAccountMapping[];
  captureMethod?: "PDF_IMPORT" | "EMAIL_PDF_IMPORT";
  onMappingsChange: (mappings: StatementAccountMapping[]) => void;
  onComplete: (result: ImportResult) => void;
  onBack: () => void;
  onAccountCreated: (account: Account) => void;
};

/**
 * Loan-tailored review step. Loan statements are metadata-only (no line-item
 * movimientos), so this drops transaction selection, destinatarios,
 * categorization, and the reconcile step entirely. The user just confirms the
 * destination LOAN account; figures are applied to the account + snapshot +
 * recurring template by importTransactions (with an empty transactions array).
 */
export function LoanStepReview({
  parseResult,
  accounts,
  mappings,
  captureMethod,
  onMappingsChange,
  onComplete,
  onBack,
  onAccountCreated,
}: Props) {
  const [localMappings, setLocalMappings] =
    useState<StatementAccountMapping[]>(mappings);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogStatementIndex, setDialogStatementIndex] = useState(0);

  // Re-sync from parent when account creation re-runs autoMatchAccounts.
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

  // Only LOAN accounts are valid targets for a loan statement.
  const loanAccounts = useMemo(
    () => accounts.filter((a) => a.account_type === "LOAN"),
    [accounts],
  );

  // Prior statement snapshots per mapped account, fetched on demand so the
  // Confirmar step can show the month-over-month change before applying.
  // `undefined` = not loaded yet; an array (possibly empty) = loaded.
  const [snapshotsByAccount, setSnapshotsByAccount] = useState<
    Record<string, StatementSnapshot[]>
  >({});

  const mappedAccountKey = localMappings
    .map((m) => m.accountId)
    .filter(Boolean)
    .sort()
    .join(",");

  useEffect(() => {
    const ids = [...new Set(mappedAccountKey.split(",").filter(Boolean))];
    const missing = ids.filter((id) => !(id in snapshotsByAccount));
    if (missing.length === 0) return;

    let cancelled = false;
    void Promise.all(
      missing.map(async (id) => {
        const res = await getStatementSnapshots(id);
        return [id, res.success ? res.data : []] as const;
      }),
    ).then((entries) => {
      if (cancelled) return;
      setSnapshotsByAccount((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mappedAccountKey]);

  function updateMapping(index: number, accountId: string) {
    setLocalMappings((prev) => {
      const next = prev.map((m) =>
        m.statementIndex === index
          ? { ...m, accountId, autoMatched: false }
          : m,
      );
      onMappingsChange(next);
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
        transactionCount: 0,
        primaryCurrency: mapping.primaryCurrency,
      });
    });
    return result;
  }

  const serializedPayload = useMemo(
    () =>
      JSON.stringify({
        transactions: [],
        statementMeta: buildStatementMeta(),
        captureMethod,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [localMappings, parseResult, captureMethod],
  );

  const [state, formAction, pending] = useActionState<
    ActionResult<ImportResult>,
    FormData
  >(
    async (prevState, formData) => {
      const result = await importTransactions(prevState, formData);
      if (result.success) onComplete(result.data);
      return result;
    },
    { success: false, error: "" },
  );

  const allMapped = localMappings.every((m) => m.accountId !== "");

  return (
    <div className="space-y-6">
      {!state.success && state.error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      {parseResult.statements.map((stmt, idx) => {
        const mapping = localMappings.find((m) => m.statementIndex === idx);
        const accountId = mapping?.accountId ?? "";

        // Month-over-month comparison vs the prior stored statement.
        const snapshots = accountId ? snapshotsByAccount[accountId] : undefined;
        const loadingEvolution = !!accountId && snapshots === undefined;
        const priorSnapshot = snapshots
          ? findPriorSnapshot(snapshots, stmt.period_to)
          : null;
        const evolutionDiffs =
          snapshots && priorSnapshot
            ? computeSnapshotDiffs(priorSnapshot, buildLoanCurrentSnapshot(stmt))
            : [];
        const isFirstImport = !!snapshots && !priorSnapshot;

        return (
          <div key={idx} className="space-y-3">
            <AccountAssignControl
              accounts={loanAccounts}
              accountId={accountId}
              autoMatched={mapping?.autoMatched}
              onSelect={(id) => updateMapping(idx, id)}
              onCreate={() => openCreateDialog(idx)}
              variant="pill"
            />

            {accountId && (
              <>
                <SectionDivider label="Cambios desde el mes anterior" />
                <div className="rounded-2xl border border-white/6 bg-z-surface-2/65 p-4">
                  <LoanEvolution
                    diffs={evolutionDiffs}
                    isFirstImport={isFirstImport}
                    loading={loadingEvolution}
                    currency={stmt.currency as CurrencyCode}
                  />
                </div>
              </>
            )}

            <SectionDivider label="Estado del préstamo" />
            <StatementSummaryCard statement={stmt} hideTransactionCount />
          </div>
        );
      })}

      <CreateAccountDialog
        statement={parseResult.statements[dialogStatementIndex]}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleAccountCreated}
      />

      <WizardActionBar
        formAction={formAction}
        formExtras={
          <input type="hidden" name="payload" value={serializedPayload} />
        }
      >
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className={GHOST_BUTTON_CLASS}
        >
          Volver
        </Button>
        <Button
          type="submit"
          disabled={!allMapped || pending}
          className={BRASS_BUTTON_CLASS}
        >
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Aplicando...
            </>
          ) : (
            "Aplicar extracto"
          )}
        </Button>
      </WizardActionBar>
    </div>
  );
}
