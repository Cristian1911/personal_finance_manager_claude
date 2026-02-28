"use client";

import { useActionState, useMemo, useState } from "react";
import { CheckCircle2, GitMerge, Loader2, SplitSquareVertical } from "lucide-react";
import { importTransactions } from "@/actions/import-transactions";
import { trackClientEvent } from "@/lib/utils/analytics";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ActionResult } from "@/types/actions";
import type {
  ImportResult,
  ReconciliationDecisionInput,
  ReconciliationPreviewResult,
  StatementMetaForImport,
  TransactionToImport,
} from "@/types/import";

type ReviewChoice = "MERGE" | "KEEP_BOTH";

export function ReconciliationStep({
  transactions,
  statementMeta,
  preview,
  onComplete,
  onBack,
}: {
  transactions: TransactionToImport[];
  statementMeta: StatementMetaForImport[];
  preview: ReconciliationPreviewResult;
  onComplete: (result: ImportResult) => void;
  onBack: () => void;
}) {
  const [reviewChoices, setReviewChoices] = useState<Record<string, ReviewChoice>>(() =>
    Object.fromEntries(
      preview.review.map((item) => [`${item.statementIndex}:${item.transactionIndex}`, "KEEP_BOTH"])
    )
  );

  const reconciliationDecisions = useMemo<ReconciliationDecisionInput[]>(() => {
    const auto = preview.autoMerge.map((item) => ({
      statementIndex: item.statementIndex,
      transactionIndex: item.transactionIndex,
      candidateTransactionId: item.candidate.id,
      decision: "AUTO_MERGE" as const,
      score: item.candidate.score,
    }));

    const review = preview.review.map((item) => ({
      statementIndex: item.statementIndex,
      transactionIndex: item.transactionIndex,
      candidateTransactionId: item.candidate.id,
      decision: reviewChoices[`${item.statementIndex}:${item.transactionIndex}`] ?? "KEEP_BOTH",
      score: item.candidate.score,
    }));

    return [...auto, ...review];
  }, [preview, reviewChoices]);

  const serializedPayload = useMemo(
    () =>
      JSON.stringify({
        transactions,
        statementMeta,
        reconciliationDecisions,
      }),
    [transactions, statementMeta, reconciliationDecisions]
  );

  const [state, formAction, pending] = useActionState<ActionResult<ImportResult>, FormData>(
    async (prevState, formData) => {
      const result = await importTransactions(prevState, formData);
      if (result.success) {
        await trackClientEvent({
          event_name: "reconciliation_manual_merge_confirmed",
          flow: "import",
          step: "persist",
          entry_point: "cta",
          success: true,
          metadata: {
            matches_auto: preview.autoMerge.length,
            matches_review: preview.review.length,
            matches_rejected: reconciliationDecisions.filter((item) => item.decision === "KEEP_BOTH")
              .length,
          },
        });
        onComplete(result.data);
      }
      return result;
    },
    { success: false, error: "" }
  );

  return (
    <div className="space-y-6">
      {!state.success && state.error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Auto-merge</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {preview.autoMerge.length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Revisión manual</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {preview.review.length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Sin match</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {preview.unmatched.length}
          </CardContent>
        </Card>
      </div>

      {preview.autoMerge.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Coincidencias de alta confianza
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {preview.autoMerge.map((item) => (
              <div key={`${item.statementIndex}:${item.transactionIndex}`} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{item.importedTransaction.raw_description}</p>
                <p className="text-xs text-muted-foreground">
                  Se fusionará con: {item.candidate.raw_description ?? item.candidate.merchant_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Score {Math.round(item.candidate.score * 100)}%
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {preview.review.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revisión manual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {preview.review.map((item) => {
              const key = `${item.statementIndex}:${item.transactionIndex}`;
              const choice = reviewChoices[key] ?? "KEEP_BOTH";
              return (
                <div key={key} className="rounded-lg border p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{item.importedTransaction.raw_description}</p>
                    <p className="text-xs text-muted-foreground">
                      Posible duplicado: {item.candidate.raw_description ?? item.candidate.merchant_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Score {Math.round(item.candidate.score * 100)}%
                    </p>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      variant={choice === "MERGE" ? "default" : "outline"}
                      onClick={() =>
                        setReviewChoices((prev) => ({ ...prev, [key]: "MERGE" }))
                      }
                    >
                      <GitMerge className="mr-2 h-4 w-4" />
                      Fusionar
                    </Button>
                    <Button
                      type="button"
                      variant={choice === "KEEP_BOTH" ? "default" : "outline"}
                      onClick={() =>
                        setReviewChoices((prev) => ({ ...prev, [key]: "KEEP_BOTH" }))
                      }
                    >
                      <SplitSquareVertical className="mr-2 h-4 w-4" />
                      Mantener ambas
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <form action={formAction} className="flex items-center gap-3">
        <input type="hidden" name="payload" value={serializedPayload} />
        <Button type="button" variant="outline" onClick={onBack}>
          Volver
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importando...
            </>
          ) : (
            "Confirmar importación"
          )}
        </Button>
      </form>
    </div>
  );
}
