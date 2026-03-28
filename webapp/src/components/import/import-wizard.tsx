"use client";

import { useEffect, useState } from "react";
import { Check, ShieldCheck } from "lucide-react";
import type { Account, CategoryWithChildren, CurrencyCode } from "@/types/domain";
import type { DestinatarioRule } from "@zeta/shared";
import type {
  ParseResponse,
  ReconciliationPreviewResult,
  StatementAccountMapping,
  ImportResult,
  StatementMetaForImport,
  TransactionToImport,
} from "@/types/import";
import { StepUpload } from "./step-upload";
import { StepReview } from "./step-review";
import { StepDestinatarios } from "./step-destinatarios";
import { StepConfirm } from "./step-confirm";
import { ReconciliationStep } from "./reconciliation-step";
import { StepResults } from "./step-results";
import { trackClientEvent } from "@/lib/utils/analytics";
import { cn } from "@/lib/utils";

type Step = "upload" | "review" | "destinatarios" | "confirm" | "reconcile" | "results";

const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "Subir PDF" },
  { key: "review", label: "Revisar" },
  { key: "destinatarios", label: "Destinatarios" },
  { key: "confirm", label: "Confirmar" },
  { key: "reconcile", label: "Reconciliar" },
  { key: "results", label: "Resultados" },
];

const STEP_DESCRIPTIONS: Record<Step, string> = {
  upload: "Sube el PDF correcto y valida que el parser reconoció la estructura del extracto.",
  review: "Confirma a qué cuenta pertenece cada extracto y ajusta monedas cuando haga falta.",
  destinatarios: "Enseña quién es quién para acelerar decisiones y futuras categorizaciones.",
  confirm: "Revisa transacciones, categorías y el paquete real que entrará a la base.",
  reconcile: "Resuelve duplicados con movimientos manuales antes de confirmar.",
  results: "Verifica qué quedó importado, qué se saltó y qué requiere seguimiento.",
};

export function ImportWizard({
  accounts,
  categories,
  destinatarioRules,
}: {
  accounts: Account[];
  categories: CategoryWithChildren[];
  destinatarioRules: DestinatarioRule[];
}) {
  const [step, setStep] = useState<Step>("upload");
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);
  const [mappings, setMappings] = useState<StatementAccountMapping[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [accountsList, setAccountsList] = useState<Account[]>(accounts);
  const [preparedTransactions, setPreparedTransactions] = useState<TransactionToImport[]>([]);
  const [preparedStatementMeta, setPreparedStatementMeta] = useState<StatementMetaForImport[]>([]);
  const [reconciliationPreview, setReconciliationPreview] =
    useState<ReconciliationPreviewResult | null>(null);
  const [activeDestinatarioRules, setActiveDestinatarioRules] = useState<DestinatarioRule[]>(destinatarioRules);

  const currentIndex = STEPS.findIndex((s) => s.key === step);
  const currentStep = STEPS[currentIndex];
  const progressValue = ((currentIndex + 1) / STEPS.length) * 100;

  useEffect(() => {
    void trackClientEvent({
      event_name: "import_flow_opened",
      flow: "import",
      step: "upload",
      entry_point: "cta",
      success: true,
    });
  }, []);

  function autoMatchAccounts(
    result: ParseResponse,
    accts: Account[],
    existingMappings?: StatementAccountMapping[]
  ): StatementAccountMapping[] {
    return result.statements.map((stmt, idx) => {
      // Keep manually-assigned mappings
      const existing = existingMappings?.find((m) => m.statementIndex === idx);
      if (existing && existing.accountId && !existing.autoMatched) {
        return existing;
      }

      let matched: Account | undefined;

      if (stmt.statement_type === "credit_card" && stmt.card_last_four) {
        matched = accts.find(
          (a) =>
            a.account_type === "CREDIT_CARD" &&
            a.mask === stmt.card_last_four
        );
      } else if (stmt.statement_type === "savings" && stmt.account_number) {
        const last4 = stmt.account_number.slice(-4);
        matched = accts.find(
          (a) => a.account_type === "SAVINGS" && a.mask === last4
        );
      } else if (stmt.statement_type === "loan" && stmt.account_number) {
        const last4 = stmt.account_number.slice(-4);
        matched = accts.find(
          (a) => a.account_type === "LOAN" && a.mask === last4
        );
      }

      return {
        statementIndex: idx,
        accountId: matched?.id ?? existing?.accountId ?? "",
        autoMatched: !!matched,
      };
    });
  }

  function handleParsed(result: ParseResponse) {
    setParseResult(result);
    setMappings(autoMatchAccounts(result, accountsList));
    setStep("review");
  }

  function handleAccountCreated(account: Account) {
    const updatedAccounts = [...accountsList, account];
    setAccountsList(updatedAccounts);
    // Re-run auto-matching with the new account, preserving manual selections
    if (parseResult) {
      setMappings((prev) => autoMatchAccounts(parseResult, updatedAccounts, prev));
    }
  }

  function handleReviewConfirm(updatedMappings: StatementAccountMapping[]) {
    setMappings(updatedMappings);
    void trackClientEvent({
      event_name: "import_account_mapping_completed",
      flow: "import",
      step: "review",
      entry_point: "cta",
      success: true,
      metadata: {
        statements_count: updatedMappings.length,
        auto_matched_count: updatedMappings.filter((m) => m.autoMatched).length,
      },
    });
    setStep("destinatarios");
  }

  function handleDestinatariosContinue(updatedRules: DestinatarioRule[]) {
    setActiveDestinatarioRules(updatedRules);
    setStep("confirm");
  }

  function handleImportComplete(result: ImportResult) {
    setImportResult(result);
    setStep("results");
  }

  function handlePrepared(payload: {
    transactions: TransactionToImport[];
    statementMeta: StatementMetaForImport[];
    reconciliationPreview: ReconciliationPreviewResult;
  }) {
    setPreparedTransactions(payload.transactions);
    setPreparedStatementMeta(payload.statementMeta);
    setReconciliationPreview(payload.reconciliationPreview);
    setStep("reconcile");
  }

  function handleReset() {
    setStep("upload");
    setParseResult(null);
    setMappings([]);
    setImportResult(null);
    setPreparedTransactions([]);
    setPreparedStatementMeta([]);
    setReconciliationPreview(null);
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-white/6 bg-z-surface-2/65 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-6">
        <div className="space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                Flujo de importación
              </p>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-z-white sm:text-2xl">
                  {currentStep.label}
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  {STEP_DESCRIPTIONS[step]}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/6 bg-black/10 px-4 py-3 lg:max-w-xs">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                <ShieldCheck className="size-4 text-z-brass" />
                Paso {currentIndex + 1} de {STEPS.length}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                El flujo sigue siendo reversible hasta confirmar, para que no se escriba ruido en la base.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
              <span>Progreso</span>
              <span>{Math.round(progressValue)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/6">
              <div
                className="h-full rounded-full bg-z-brass transition-[width] duration-300"
                style={{ width: `${progressValue}%` }}
              />
            </div>
          </div>

          <nav
            aria-label="Progreso"
            className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6"
          >
            {STEPS.map((s, i) => (
              <div
                key={s.key}
                className={cn(
                  "rounded-2xl border px-3 py-3 transition-colors",
                  i < currentIndex
                    ? "border-z-brass/30 bg-z-brass/10 text-z-brass"
                    : i === currentIndex
                      ? "border-z-olive-deep/60 bg-z-olive-deep/35 text-z-sage-light"
                      : "border-white/6 bg-black/10 text-muted-foreground"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                      i < currentIndex
                        ? "border-z-brass/40 bg-z-brass text-z-ink"
                        : i === currentIndex
                          ? "border-z-brass/30 bg-black/20 text-z-sage-light"
                          : "border-white/10 text-muted-foreground"
                    )}
                  >
                    {i < currentIndex ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{s.label}</p>
                    <p className="mt-0.5 text-xs opacity-80">
                      {i < currentIndex ? "Completado" : i === currentIndex ? "En curso" : "Pendiente"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </nav>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/6 bg-z-surface-2/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-6">
        {/* Step content */}
        {step === "upload" && <StepUpload onParsed={handleParsed} />}
        {step === "review" && parseResult && (
          <StepReview
            parseResult={parseResult}
            accounts={accountsList}
            mappings={mappings}
            onConfirm={handleReviewConfirm}
            onBack={() => setStep("upload")}
            onAccountCreated={handleAccountCreated}
          />
        )}
        {step === "destinatarios" && parseResult && (
          <StepDestinatarios
            parseResult={parseResult}
            mappings={mappings}
            categories={categories}
            destinatarioRules={activeDestinatarioRules}
            onContinue={handleDestinatariosContinue}
            onBack={() => setStep("review")}
          />
        )}
        {step === "confirm" && parseResult && (
          <StepConfirm
            parseResult={parseResult}
            mappings={mappings}
            categories={categories}
            destinatarioRules={activeDestinatarioRules}
            onContinue={handlePrepared}
            onBack={() => setStep("destinatarios")}
          />
        )}
        {step === "reconcile" && reconciliationPreview && (
          <ReconciliationStep
            transactions={preparedTransactions}
            statementMeta={preparedStatementMeta}
            preview={reconciliationPreview}
            onComplete={handleImportComplete}
            onBack={() => setStep("confirm")}
          />
        )}
        {step === "results" && importResult && (
          <StepResults
            result={importResult}
            currency={(parseResult?.statements[0]?.currency ?? "COP") as CurrencyCode}
            onReset={handleReset}
          />
        )}
      </section>
    </div>
  );
}
