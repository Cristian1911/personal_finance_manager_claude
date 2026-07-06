"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { getPendingScreenshotFile } from "@/components/mobile/mobile-sheet-provider";
import { markEmailPdfStatementImported } from "@/actions/email-pdf-ingest";
import type { Account, CategoryWithChildren, CurrencyCode } from "@/types/domain";
import type { DestinatarioRule } from "@zeta/shared";
import type { PdfPasswordSuggestion } from "@/actions/pdf-passwords";
import type {
  ParseResponse,
  ReconciliationPreviewResult,
  StatementAccountMapping,
  ImportResult,
  StatementMetaForImport,
  TransactionToImport,
} from "@/types/import";
import { StepUpload, type ParsedSourceMeta } from "./step-upload";
import { StepReview } from "./step-review";
import { ReconciliationStep } from "./reconciliation-step";
import { StepResults } from "./step-results";
import { LoanStepReview } from "./loan-step-review";
import { LoanStepResults } from "./loan-step-results";
import { trackClientEvent } from "@/lib/utils/analytics";
import { accountMaskSuffixMatches, normalizeAccountMaskSuffix } from "@/lib/utils/account-mask";
import { useHideTabBar } from "@/components/mobile/v2/tab-bar-visibility-provider";
import { cn } from "@/lib/utils";

type Step = "upload" | "review" | "reconcile" | "results";

// Standard (credit-card / savings) flow: transaction-centric, includes reconcile.
const STANDARD_STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "Subir" },
  { key: "review", label: "Revisar" },
  { key: "reconcile", label: "Reconciliar" },
  { key: "results", label: "Listo" },
];

// Loan flow: metadata-only, no movimientos to select or reconcile.
const LOAN_STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "Subir" },
  { key: "review", label: "Confirmar" },
  { key: "results", label: "Listo" },
];

const STEP_DESCRIPTIONS: Record<Step, string> = {
  upload: "Sube tu extracto o captura. Detectamos el banco automáticamente.",
  review: "Confirma la cuenta destino. Categorías y destinatarios se asignan en silencio.",
  reconcile: "Resuelve duplicados y ambigüedades. Cada chip abre el detalle.",
  results: "Qué entró, qué se saltó, y qué necesita seguimiento.",
};

const LOAN_STEP_DESCRIPTIONS: Record<Step, string> = {
  upload: "Sube tu extracto. Detectamos el banco automáticamente.",
  review: "Confirma el préstamo destino. Aplicamos saldo, cuota y tasa al estado.",
  reconcile: "",
  results: "Cómo evolucionó tu préstamo desde el extracto anterior.",
};

export function ImportWizard({
  accounts,
  categories: _categories,
  destinatarioRules,
  initialFile,
  initialVaultSuggestions,
  initialParseResult,
  pendingEmailStatementId,
  onImportedFromEmail,
  onReset,
  onStepChange,
}: {
  accounts: Account[];
  categories: CategoryWithChildren[];
  destinatarioRules: DestinatarioRule[];
  initialFile?: File | null;
  initialVaultSuggestions?: PdfPasswordSuggestion[];
  initialParseResult?: ParseResponse | null;
  pendingEmailStatementId?: string | null;
  onImportedFromEmail?: (id: string) => void;
  onReset?: () => void;
  onStepChange?: (step: "upload" | "review" | "reconcile" | "results") => void;
}) {
  const [step, setStep] = useState<Step>(initialParseResult ? "review" : "upload");
  const [parseResult, setParseResult] = useState<ParseResponse | null>(
    initialParseResult ?? null,
  );
  const [mappings, setMappings] = useState<StatementAccountMapping[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [accountsList, setAccountsList] = useState<Account[]>(accounts);
  const [preparedTransactions, setPreparedTransactions] = useState<TransactionToImport[]>([]);
  const [preparedStatementMeta, setPreparedStatementMeta] = useState<StatementMetaForImport[]>([]);
  const [reconciliationPreview, setReconciliationPreview] =
    useState<ReconciliationPreviewResult | null>(null);
  // Screenshot imports are tier-2 (semi-structured), not bank-verified PDFs.
  const [ocrCaptureMethod, setOcrCaptureMethod] = useState<"OCR_SINGLE" | "OCR_BATCH" | null>(null);
  const activeEmailStatementIdRef = useRef<string | null>(pendingEmailStatementId ?? null);

  // Loan path: every parsed statement is a loan. Loan statements are
  // metadata-only (no movimientos), so we mount a lean confirm flow and skip
  // the reconcile step. Mixed PDFs (loan + credit card) fall back to the
  // standard flow, which already renders loan summary cards.
  const isLoanOnly =
    !!parseResult &&
    parseResult.statements.length > 0 &&
    parseResult.statements.every((s) => s.statement_type === "loan");

  const steps = isLoanOnly ? LOAN_STEPS : STANDARD_STEPS;
  const stepDescriptions = isLoanOnly ? LOAN_STEP_DESCRIPTIONS : STEP_DESCRIPTIONS;
  const currentIndex = steps.findIndex((s) => s.key === step);
  const currentStep = steps[currentIndex];

  useEffect(() => {
    onStepChange?.(step);
  }, [step, onStepChange]);

  // Steps 2–4 (review/reconcile/results) are focus tasks: hide the bottom tab
  // bar so the sticky WizardActionBar is the only bottom UI. Step 1 (upload)
  // keeps the tab bar visible — it's a landing surface where the user might
  // bail back to another part of the app.
  useHideTabBar(step !== "upload");

  const searchParams = useSearchParams();
  const screenshotFileRef = useRef<File | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);

  useEffect(() => {
    if (searchParams.get("mode") === "screenshot" && !screenshotFileRef.current) {
      const file = getPendingScreenshotFile();
      if (file) {
        screenshotFileRef.current = file;
        setScreenshotFile(file);
      }
    }
  }, [searchParams]);

  const resolvedInitialFile = initialFile ?? screenshotFile;

  useEffect(() => {
    void trackClientEvent({
      event_name: "import_flow_opened",
      flow: "import",
      step: "upload",
      entry_point: "cta",
      success: true,
    });
  }, []);

  useEffect(() => {
    if (initialParseResult && pendingEmailStatementId) {
      setParseResult(initialParseResult);
      setMappings(autoMatchAccounts(initialParseResult, accountsList));
      setImportResult(null);
      setPreparedTransactions([]);
      setPreparedStatementMeta([]);
      setReconciliationPreview(null);
      setStep("review");
      activeEmailStatementIdRef.current = pendingEmailStatementId;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialParseResult, pendingEmailStatementId]);

  function autoMatchAccounts(
    result: ParseResponse,
    accts: Account[],
    existingMappings?: StatementAccountMapping[],
  ): StatementAccountMapping[] {
    return result.statements.map((stmt, idx) => {
      const existing = existingMappings?.find((m) => m.statementIndex === idx);
      if (existing && existing.accountId && !existing.autoMatched) {
        return existing;
      }

      let matched: Account | undefined;
      if (stmt.statement_type === "credit_card" && stmt.card_last_four) {
        matched = accts.find(
          (a) =>
            a.account_type === "CREDIT_CARD" &&
            accountMaskSuffixMatches(a.mask, stmt.card_last_four),
        );
      } else if (stmt.statement_type === "savings" && stmt.account_number) {
        const last4 = normalizeAccountMaskSuffix(stmt.account_number);
        matched = accts.find(
          (a) => a.account_type === "SAVINGS" && accountMaskSuffixMatches(a.mask, last4),
        );
      } else if (stmt.statement_type === "loan" && stmt.account_number) {
        const last4 = normalizeAccountMaskSuffix(stmt.account_number);
        matched = accts.find(
          (a) => a.account_type === "LOAN" && accountMaskSuffixMatches(a.mask, last4),
        );
      }

      return {
        statementIndex: idx,
        accountId: matched?.id ?? existing?.accountId ?? "",
        autoMatched: !!matched,
      };
    });
  }

  function handleParsed(result: ParseResponse, meta?: ParsedSourceMeta) {
    setOcrCaptureMethod(
      meta?.source === "image"
        ? meta.fileCount > 1
          ? "OCR_BATCH"
          : "OCR_SINGLE"
        : null
    );
    setParseResult(result);
    setMappings(autoMatchAccounts(result, accountsList));
    setStep("review");
  }

  const effectiveCaptureMethod = pendingEmailStatementId
    ? ("EMAIL_PDF_IMPORT" as const)
    : ocrCaptureMethod ?? ("PDF_IMPORT" as const);

  function handleAccountCreated(account: Account) {
    const updatedAccounts = [...accountsList, account];
    setAccountsList(updatedAccounts);
    if (parseResult) {
      setMappings((prev) => autoMatchAccounts(parseResult, updatedAccounts, prev));
    }
  }

  function handleReviewContinue(payload: {
    transactions: TransactionToImport[];
    statementMeta: StatementMetaForImport[];
    reconciliationPreview: ReconciliationPreviewResult;
  }) {
    setPreparedTransactions(payload.transactions);
    setPreparedStatementMeta(payload.statementMeta);
    setReconciliationPreview(payload.reconciliationPreview);
    setStep("reconcile");
  }

  function handleImportComplete(result: ImportResult) {
    setImportResult(result);
    setStep("results");

    const emailId = activeEmailStatementIdRef.current;
    // Clear the queue row once the user completes the flow without errors.
    // Skipped-only still counts: the statement's data is already in the system.
    // accountUpdates>0 covers metadata-only imports (loans, savings with no new
    // tx) where imported=skipped=0 but the statement was applied to the account.
    if (
      emailId &&
      result.errors === 0 &&
      (result.imported > 0 ||
        result.skipped > 0 ||
        (result.accountUpdates?.length ?? 0) > 0)
    ) {
      activeEmailStatementIdRef.current = null;
      void markEmailPdfStatementImported(emailId).then((res) => {
        if (res.success) {
          onImportedFromEmail?.(emailId);
        }
      });
    }
  }

  const handleReset = useCallback(() => {
    setStep("upload");
    setParseResult(null);
    setOcrCaptureMethod(null);
    setMappings([]);
    setImportResult(null);
    setPreparedTransactions([]);
    setPreparedStatementMeta([]);
    setReconciliationPreview(null);
    activeEmailStatementIdRef.current = null;
    onReset?.();
  }, [onReset]);

  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted && step === "results") {
        handleReset();
      }
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [step, handleReset]);

  return (
    <div
      className={cn(
        "space-y-4 lg:space-y-6",
        // Mobile: leave room for the sticky WizardActionBar so the last
        // row of content isn't trapped behind it. The tab bar is hidden in
        // steps 2–4 (see useHideTabBar above), so we only reserve safe-area
        // + the bar's own height (~6rem). Desktop bar is inline.
        step !== "upload" && "pb-[calc(env(safe-area-inset-bottom)_+_6rem)] lg:pb-0",
      )}
    >
      <section className="space-y-3 lg:overflow-hidden lg:rounded-3xl lg:border lg:border-white/6 lg:bg-z-surface-2/65 lg:p-6 lg:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
            Paso {currentIndex + 1} de {steps.length}
          </p>
          <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-z-white lg:text-2xl">
            {currentStep?.label}
          </h2>
        </div>

        <p className="hidden text-sm leading-6 text-z-sage-light lg:block">
          {stepDescriptions[step]}
        </p>

        {/* Single progress indicator: pill-bars on mobile, labelled cards on desktop */}
        <nav
          aria-label="Progreso"
          className={cn(
            "flex items-center gap-1.5 lg:grid lg:gap-2",
            isLoanOnly ? "lg:grid-cols-3" : "lg:grid-cols-4",
          )}
        >
          {steps.map((s, i) => {
            const done = i < currentIndex;
            const active = i === currentIndex;
            return (
              <div
                key={s.key}
                className={cn(
                  // mobile: pill bar; desktop: card
                  "h-1.5 flex-1 rounded-full transition-colors",
                  "lg:flex lg:h-auto lg:flex-none lg:items-center lg:gap-3 lg:rounded-2xl lg:border lg:px-3 lg:py-3",
                  done
                    ? "bg-z-brass lg:border-z-brass/30 lg:bg-z-brass/10 lg:text-z-brass"
                    : active
                      ? "bg-z-brass/60 lg:border-z-olive-deep/60 lg:bg-z-olive-deep/35 lg:text-z-sage-light"
                      : "bg-white/8 lg:border-white/6 lg:bg-black/10 lg:text-z-sage-dark",
                )}
              >
                <div className="hidden lg:flex lg:items-center lg:gap-3">
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                      done
                        ? "border-z-brass/40 bg-z-brass text-z-ink"
                        : active
                          ? "border-z-brass/30 bg-black/20 text-z-sage-light"
                          : "border-white/6 text-z-sage-dark",
                    )}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{s.label}</p>
                    <p className="mt-0.5 text-xs opacity-80">
                      {done ? "Completado" : active ? "En curso" : "Pendiente"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
      </section>

      <section className="lg:rounded-3xl lg:border lg:border-white/6 lg:bg-z-surface-2/45 lg:p-6 lg:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        {step === "upload" && (
          <StepUpload
            onParsed={handleParsed}
            initialFile={resolvedInitialFile}
            initialVaultSuggestions={initialVaultSuggestions}
          />
        )}
        {step === "review" && parseResult && isLoanOnly && (
          <LoanStepReview
            parseResult={parseResult}
            accounts={accountsList}
            mappings={mappings}
            captureMethod={effectiveCaptureMethod}
            onMappingsChange={setMappings}
            onComplete={handleImportComplete}
            onBack={() => setStep("upload")}
            onAccountCreated={handleAccountCreated}
          />
        )}
        {step === "review" && parseResult && !isLoanOnly && (
          <StepReview
            parseResult={parseResult}
            captureMethod={effectiveCaptureMethod}
            accounts={accountsList}
            mappings={mappings}
            destinatarioRules={destinatarioRules}
            onMappingsChange={setMappings}
            onContinue={handleReviewContinue}
            onBack={() => setStep("upload")}
            onAccountCreated={handleAccountCreated}
          />
        )}
        {step === "reconcile" && reconciliationPreview && (
          <ReconciliationStep
            transactions={preparedTransactions}
            statementMeta={preparedStatementMeta}
            preview={reconciliationPreview}
            currency={(parseResult?.statements[0]?.currency ?? "COP") as CurrencyCode}
            captureMethod={effectiveCaptureMethod}
            onComplete={handleImportComplete}
            onBack={() => setStep("review")}
          />
        )}
        {step === "results" && importResult && isLoanOnly && (
          <LoanStepResults
            result={importResult}
            currency={(parseResult?.statements[0]?.currency ?? "COP") as CurrencyCode}
            onReset={handleReset}
          />
        )}
        {step === "results" && importResult && !isLoanOnly && (
          <StepResults
            result={importResult}
            currency={(parseResult?.statements[0]?.currency ?? "COP") as CurrencyCode}
            onReset={handleReset}
            emailStatementId={activeEmailStatementIdRef.current}
            onDismissedFromEmail={(id) => {
              activeEmailStatementIdRef.current = null;
              onImportedFromEmail?.(id);
            }}
          />
        )}
      </section>
    </div>
  );
}
