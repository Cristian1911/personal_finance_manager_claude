"use client";

import { useCallback, useMemo, useState } from "react";
import { ImportWizard } from "@/components/import/import-wizard";
import { PendingEmailStatements } from "@/components/import/pending-email-statements";
import type { Account, CategoryWithChildren, PendingEmailStatement } from "@/types/domain";
import type { DestinatarioRule } from "@zeta/shared";
import type { ParsedStatement, ParseResponse } from "@/types/import";

interface Props {
  accounts: Account[];
  categories: CategoryWithChildren[];
  destinatarioRules: DestinatarioRule[];
  pendingStatements: PendingEmailStatement[];
}

export function ImportPageClient({
  accounts,
  categories,
  destinatarioRules,
  pendingStatements: initialPending,
}: Props) {
  const [pendingStatements, setPendingStatements] = useState(initialPending);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedParseResult, setSelectedParseResult] = useState<ParseResponse | null>(null);

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
    setPendingStatements((prev) => prev.filter((s) => s.id !== id));
    setSelectedId((current) => (current === id ? null : current));
  }, []);

  // Hide any statement that has been selected for review from the pending list
  // so the user doesn't see two entry points while the wizard is active.
  const visiblePending = useMemo(
    () => pendingStatements.filter((s) => s.id !== selectedId),
    [pendingStatements, selectedId],
  );

  return (
    <>
      <PendingEmailStatements
        key={selectedId ?? "none"}
        statements={visiblePending}
        onReviewStatement={handleReviewStatement}
      />

      <div id="import-wizard" className="scroll-mt-16">
        <ImportWizard
          key={selectedId ?? "fresh"}
          accounts={accounts}
          categories={categories}
          destinatarioRules={destinatarioRules}
          initialParseResult={selectedParseResult}
          pendingEmailStatementId={selectedId}
          onImportedFromEmail={handleImportedFromEmail}
        />
      </div>
    </>
  );
}
