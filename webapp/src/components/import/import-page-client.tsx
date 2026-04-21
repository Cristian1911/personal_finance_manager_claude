"use client";

import { useCallback, useMemo, useState } from "react";
import { ImportWizard } from "@/components/import/import-wizard";
import { PendingEmailStatements } from "@/components/import/pending-email-statements";
import type { Account, CategoryWithChildren, PendingEmailStatement } from "@/types/domain";
import type { DestinatarioRule } from "@zeta/shared";
import type { ParsedStatement, ParseResponse } from "@/types/import";
import type { PdfPasswordSuggestion } from "@/actions/pdf-passwords";

interface Props {
  accounts: Account[];
  categories: CategoryWithChildren[];
  destinatarioRules: DestinatarioRule[];
  pendingStatements: PendingEmailStatement[];
  initialVaultSuggestions?: PdfPasswordSuggestion[];
  mobileAboutPanel?: React.ReactNode;
}

export function ImportPageClient({
  accounts,
  categories,
  destinatarioRules,
  pendingStatements: initialPending,
  initialVaultSuggestions,
  mobileAboutPanel,
}: Props) {
  const [pendingStatements, setPendingStatements] = useState(initialPending);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedParseResult, setSelectedParseResult] = useState<ParseResponse | null>(null);
  const [wizardStep, setWizardStep] = useState<
    "upload" | "review" | "reconcile" | "results"
  >("upload");

  const handleReviewStatement = useCallback((statement: PendingEmailStatement) => {
    if (!Array.isArray(statement.parsed_data) || statement.parsed_data.length === 0) return;
    const statements = statement.parsed_data as unknown as ParsedStatement[];
    setSelectedId(statement.id);
    setSelectedParseResult({ statements });
    // Scroll the wizard into view so the user sees the jump to "Revisar".
    requestAnimationFrame(() => {
      const el = document.getElementById("import-wizard");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const handleImportedFromEmail = useCallback((id: string) => {
    // Remove from the pending list so the user doesn't see it as a re-entry
    // point, but do NOT clear `selectedId` here — that would remount the
    // wizard (via `key`) and blow away the results step before the user can
    // see it. The wizard stays mounted on the current id until the user
    // explicitly resets or picks another pending statement.
    setPendingStatements((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleWizardReset = useCallback(() => {
    setSelectedId(null);
    setSelectedParseResult(null);
  }, []);

  // Hide any statement that has been selected for review from the pending list
  // so the user doesn't see two entry points while the wizard is active.
  const visiblePending = useMemo(
    () => pendingStatements.filter((s) => s.id !== selectedId),
    [pendingStatements, selectedId],
  );

  const flowActive = wizardStep !== "upload";

  return (
    <div className="space-y-6">
      <div id="import-wizard" className="scroll-mt-16">
        <ImportWizard
          key={selectedId ?? "fresh"}
          accounts={accounts}
          categories={categories}
          destinatarioRules={destinatarioRules}
          initialParseResult={selectedParseResult}
          pendingEmailStatementId={selectedId}
          onImportedFromEmail={handleImportedFromEmail}
          onReset={handleWizardReset}
          onStepChange={setWizardStep}
          initialVaultSuggestions={initialVaultSuggestions}
        />
      </div>

      {!flowActive && (
        <>
          <PendingEmailStatements
            key={selectedId ?? "none"}
            statements={visiblePending}
            onReviewStatement={handleReviewStatement}
          />
          {mobileAboutPanel}
        </>
      )}
    </div>
  );
}
