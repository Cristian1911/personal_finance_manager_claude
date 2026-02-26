"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import type { Account, CategoryWithChildren } from "@/types/domain";
import type {
  ParseResponse,
  StatementAccountMapping,
  ImportResult,
} from "@/types/import";
import { StepUpload } from "./step-upload";
import { StepReview } from "./step-review";
import { StepConfirm } from "./step-confirm";
import { StepResults } from "./step-results";
import { trackClientEvent } from "@/lib/utils/analytics";

type Step = "upload" | "review" | "confirm" | "results";

const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "Subir PDF" },
  { key: "review", label: "Revisar" },
  { key: "confirm", label: "Confirmar" },
  { key: "results", label: "Resultados" },
];

export function ImportWizard({
  accounts,
  categories,
}: {
  accounts: Account[];
  categories: CategoryWithChildren[];
}) {
  const [step, setStep] = useState<Step>("upload");
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);
  const [mappings, setMappings] = useState<StatementAccountMapping[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [accountsList, setAccountsList] = useState<Account[]>(accounts);

  const currentIndex = STEPS.findIndex((s) => s.key === step);

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
    setStep("confirm");
  }

  function handleImportComplete(result: ImportResult) {
    setImportResult(result);
    setStep("results");
  }

  function handleReset() {
    setStep("upload");
    setParseResult(null);
    setMappings([]);
    setImportResult(null);
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <nav aria-label="Progreso" className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium ${
                  i < currentIndex
                    ? "border-primary bg-primary text-primary-foreground"
                    : i === currentIndex
                      ? "border-primary text-primary"
                      : "border-muted-foreground/30 text-muted-foreground/50"
                }`}
              >
                {i < currentIndex ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={`text-sm hidden sm:inline ${
                  i === currentIndex
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-px w-8 ${
                  i < currentIndex ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              />
            )}
          </div>
        ))}
      </nav>

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
      {step === "confirm" && parseResult && (
        <StepConfirm
          parseResult={parseResult}
          mappings={mappings}
          categories={categories}
          onComplete={handleImportComplete}
          onBack={() => setStep("review")}
        />
      )}
      {step === "results" && importResult && (
        <StepResults result={importResult} onReset={handleReset} />
      )}
    </div>
  );
}
