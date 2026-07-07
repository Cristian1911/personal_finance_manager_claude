"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ImportWizard } from "@/components/import/import-wizard";
import { getPendingScreenshotFile } from "@/components/mobile/mobile-sheet-provider";
import { PendingEmailStatements } from "@/components/import/pending-email-statements";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
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
  const [screenshotEntry, setScreenshotEntry] = useState<{ file: File; runSeq: number } | null>(null);
  // Bumped only when a screenshot pick needs a hard wizard remount. Never
  // reset — the wizard `key` derived from it must always move forward.
  const runSeq = useRef(0);
  const searchParams = useSearchParams();

  // FAB "Importar pantallazo" stashes the picked file and navigates here with
  // ?mode=screenshot&pick=N. This runs on mount AND on same-segment
  // navigations (the pick counter guarantees searchParams change), so a new
  // screenshot always reaches the wizard — even when /import is already
  // mounted showing a previous run's state.
  useEffect(() => {
    if (searchParams.get("mode") !== "screenshot") return;
    const file = getPendingScreenshotFile();
    if (!file) return;
    // Mid-flow or email-review pick → bump the key for a fresh wizard run.
    // At the upload step, keep the mounted wizard instead: StepUpload's
    // addFiles() then resolves the new image against anything already staged
    // (removing a staged PDF WITH its toast, batching extra captures) rather
    // than a silent remount wipe.
    if (wizardStep !== "upload" || selectedId !== null) {
      runSeq.current += 1;
    }
    setSelectedId(null);
    setSelectedParseResult(null);
    setScreenshotEntry({ file, runSeq: runSeq.current });
    // Re-runs from the extra deps are no-ops: the pending file is consumed
    // (nulled) on first pickup.
  }, [searchParams, wizardStep, selectedId]);

  const handleReviewStatement = useCallback((statement: PendingEmailStatement) => {
    if (!Array.isArray(statement.parsed_data) || statement.parsed_data.length === 0) return;
    const statements = statement.parsed_data as unknown as ParsedStatement[];
    setSelectedId(statement.id);
    setSelectedParseResult({ statements });
    setScreenshotEntry(null);
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
    // Also forget the screenshot handoff: keeping it would re-stage the old
    // file when the wizard remounts on the "fresh" key.
    setScreenshotEntry(null);
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
      {/* On step 1 (upload) the header is a normal back arrow → /gestionar.
          Once the user crosses the commit threshold (steps 2–4), swap to an
          X icon labeled "Salir" so it's visually distinct from the wizard's
          own "Atrás" button (which steps back without losing parsed data). */}
      <MobileHeader
        variant="sub"
        title="Importar Extracto"
        backHref="/gestionar"
        backStyle={flowActive ? "exit" : "back"}
      />

      <div id="import-wizard" className="scroll-mt-16">
        <ImportWizard
          key={selectedId ?? `fresh-${screenshotEntry?.runSeq ?? 0}`}
          accounts={accounts}
          categories={categories}
          destinatarioRules={destinatarioRules}
          initialFile={screenshotEntry?.file ?? null}
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
            vaultSuggestions={initialVaultSuggestions}
          />
          {mobileAboutPanel}
        </>
      )}
    </div>
  );
}
