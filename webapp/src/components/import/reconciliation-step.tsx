"use client";

import { useActionState, useMemo, useState } from "react";
import { GitMerge, Loader2, SplitSquareVertical } from "lucide-react";
import { importTransactions } from "@/actions/import-transactions";
import { trackClientEvent } from "@/lib/utils/analytics";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReconcileChip } from "./reconcile-chip";
import { Narrator } from "./narrator";
import { WizardActionBar } from "./wizard-action-bar";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/types/actions";
import type { CurrencyCode } from "@/types/domain";
import type {
  ImportResult,
  ReconciliationDecisionInput,
  ReconciliationPreviewItem,
  ReconciliationPreviewResult,
  StatementMetaForImport,
  TransactionToImport,
} from "@/types/import";

type ReviewChoice = "MERGE" | "KEEP_BOTH";
type PanelKey = "unmatched" | "merchants" | "duplicates" | "review" | null;

function PairCard({
  item,
  currency,
}: {
  item: ReconciliationPreviewItem;
  currency: CurrencyCode;
}) {
  const imported = item.importedTransaction;
  const candidate = item.candidate;
  return (
    <div className="rounded-xl border border-white/6 bg-z-surface-2/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="grid flex-1 grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
              Extracto
            </p>
            <p className="text-sm font-medium leading-tight text-z-white">
              {imported.raw_description}
            </p>
            <p className="text-xs text-z-sage-dark">
              {formatDate(imported.transaction_date)}
            </p>
            <p
              className={cn(
                "text-sm font-semibold",
                imported.direction === "INFLOW" ? "text-z-income" : "text-z-debt",
              )}
            >
              {imported.direction === "OUTFLOW" ? "−" : "+"}
              {formatCurrency(imported.amount, currency)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
              Existente
            </p>
            <p className="text-sm font-medium leading-tight text-z-white">
              {candidate.raw_description ?? candidate.merchant_name}
            </p>
            <p className="text-xs text-z-sage-dark">
              {formatDate(candidate.transaction_date)}
            </p>
            <p className="text-sm font-semibold text-z-sage-light">
              {formatCurrency(candidate.amount, currency)}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="ml-2 shrink-0 text-xs">
          {Math.round(candidate.score * 100)}%
        </Badge>
      </div>
    </div>
  );
}

export function ReconciliationStep({
  transactions,
  statementMeta,
  preview,
  currency,
  captureMethod,
  onComplete,
  onBack,
}: {
  transactions: TransactionToImport[];
  statementMeta: StatementMetaForImport[];
  preview: ReconciliationPreviewResult;
  currency: CurrencyCode;
  captureMethod?: "PDF_IMPORT" | "EMAIL_PDF_IMPORT";
  onComplete: (result: ImportResult) => void;
  onBack: () => void;
}) {
  const [panel, setPanel] = useState<PanelKey>(null);

  const [reviewChoices, setReviewChoices] = useState<Record<string, ReviewChoice>>(() =>
    Object.fromEntries(
      preview.review.map((item) => [
        `${item.statementIndex}:${item.transactionIndex}`,
        "KEEP_BOTH",
      ]),
    ),
  );

  // Allow overriding an auto-merge to keep-both when user expands Duplicados panel.
  const [rejectedAutoMerges, setRejectedAutoMerges] = useState<Set<string>>(new Set());

  // Only surface raw descriptions that didn't auto-match any existing
  // destinatario rule during step 2 — those are the truly new merchants.
  const newMerchantNames = useMemo(
    () =>
      Array.from(
        new Set(
          preview.unmatched
            .filter((i) => !i.importedTransaction.destinatario_id)
            .map((i) => i.importedTransaction.raw_description)
            .filter((s): s is string => typeof s === "string" && s.length > 0),
        ),
      ),
    [preview.unmatched],
  );

  const reconciliationDecisions = useMemo<ReconciliationDecisionInput[]>(() => {
    const auto = preview.autoMerge
      .filter(
        (item) =>
          !rejectedAutoMerges.has(`${item.statementIndex}:${item.transactionIndex}`),
      )
      .map((item) => ({
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
      decision:
        reviewChoices[`${item.statementIndex}:${item.transactionIndex}`] ?? "KEEP_BOTH",
      score: item.candidate.score,
    }));

    return [...auto, ...review];
  }, [preview, reviewChoices, rejectedAutoMerges]);

  const serializedPayload = useMemo(
    () =>
      JSON.stringify({
        transactions,
        statementMeta,
        reconciliationDecisions,
        captureMethod,
      }),
    [transactions, statementMeta, reconciliationDecisions, captureMethod],
  );

  const [state, formAction, pending] = useActionState<
    ActionResult<ImportResult>,
    FormData
  >(
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
            matches_rejected: reconciliationDecisions.filter(
              (item) => item.decision === "KEEP_BOTH",
            ).length,
          },
        });
        onComplete(result.data);
      }
      return result;
    },
    { success: false, error: "" },
  );

  const narratorLine = (() => {
    if (preview.review.length > 0)
      return `Hay ${preview.review.length} ambigu${
        preview.review.length === 1 ? "o" : "os"
      } — tú decides. Son solo unos toques.`;
    if (preview.autoMerge.length > 0)
      return `Se omiten ${preview.autoMerge.length} duplicado${
        preview.autoMerge.length === 1 ? "" : "s"
      }. El resto entra fresco.`;
    return "Sin sorpresas — nada duplicado, nada ambiguo. Dale.";
  })();

  function toggle(key: PanelKey) {
    setPanel((prev) => (prev === key ? null : key));
  }

  function toggleRejectAutoMerge(key: string) {
    setRejectedAutoMerges((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      {!state.success && state.error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <ReconcileChip
          label="Nuevos"
          value={preview.unmatched.length}
          hint="entran limpio"
          tone="income"
          active={panel === "unmatched"}
          onClick={() => toggle("unmatched")}
        />
        <ReconcileChip
          label="Destinatarios"
          value={newMerchantNames.length}
          hint="sugeridos"
          tone="brass"
          active={panel === "merchants"}
          onClick={() => toggle("merchants")}
          disabled={newMerchantNames.length === 0}
        />
        <ReconcileChip
          label="Duplicados"
          value={preview.autoMerge.length}
          hint="se omiten"
          tone="brass"
          active={panel === "duplicates"}
          onClick={() => toggle("duplicates")}
          disabled={preview.autoMerge.length === 0}
        />
        <ReconcileChip
          label="Ambiguos"
          value={preview.review.length}
          hint="tú decides"
          tone="alert"
          active={panel === "review"}
          onClick={() => toggle("review")}
          disabled={preview.review.length === 0}
        />
      </div>

      {panel === "unmatched" && (
        <Panel
          title="Movimientos nuevos"
          caption="No coinciden con nada existente — se importan limpios."
        >
          {preview.unmatched.length === 0 ? (
            <EmptyNote>Sin movimientos nuevos. Raro pero OK.</EmptyNote>
          ) : (
            <ul className="space-y-1.5">
              {preview.unmatched.map((item) => (
                <li
                  key={`unmatched-${item.statementIndex}:${item.transactionIndex}`}
                  className="rounded-lg border border-white/6 bg-z-surface-2/40 px-3 py-2 text-xs text-z-sage-light"
                >
                  {item.importedTransaction.raw_description}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {panel === "merchants" && (
        <Panel
          title="Destinatarios sugeridos"
          caption="Merchants que aún no están en tu lista. Se importan sin problema — los entrenas después en Destinatarios."
        >
          {newMerchantNames.length === 0 ? (
            <EmptyNote>Ya tenías a todos registrados.</EmptyNote>
          ) : (
            <ul className="space-y-1.5">
              {newMerchantNames.map((name) => (
                <li
                  key={`new-m-${name}`}
                  className="rounded-lg border border-white/6 bg-z-surface-2/40 px-3 py-2 text-xs text-z-sage-light"
                >
                  <span className="truncate">{name}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {panel === "duplicates" && (
        <Panel
          title="Duplicados detectados"
          caption="Coinciden con movimientos ya registrados y se omiten. Puedes forzar mantener ambos si crees que son distintos."
        >
          <div className="space-y-3">
            {preview.autoMerge.map((item) => {
              const key = `${item.statementIndex}:${item.transactionIndex}`;
              const rejected = rejectedAutoMerges.has(key);
              return (
                <div key={key} className="space-y-2">
                  <PairCard item={item} currency={currency} />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant={rejected ? "default" : "outline"}
                      onClick={() => toggleRejectAutoMerge(key)}
                    >
                      {rejected ? (
                        <>
                          <SplitSquareVertical className="mr-1.5 h-3.5 w-3.5" />
                          Mantener ambos
                        </>
                      ) : (
                        <>
                          <GitMerge className="mr-1.5 h-3.5 w-3.5" />
                          Omitir como duplicado
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {panel === "review" && (
        <Panel
          title="Necesitan tu decisión"
          caption="Parece el mismo movimiento pero no estamos seguros. Tú eliges."
        >
          <div className="space-y-4">
            {preview.review.map((item) => {
              const key = `${item.statementIndex}:${item.transactionIndex}`;
              const choice = reviewChoices[key] ?? "KEEP_BOTH";
              return (
                <div key={key} className="space-y-3">
                  <PairCard item={item} currency={currency} />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={choice === "MERGE" ? "default" : "outline"}
                      size="sm"
                      onClick={() =>
                        setReviewChoices((prev) => ({ ...prev, [key]: "MERGE" }))
                      }
                    >
                      <GitMerge className="mr-1.5 h-3.5 w-3.5" />
                      Fusionar
                    </Button>
                    <Button
                      type="button"
                      variant={choice === "KEEP_BOTH" ? "default" : "outline"}
                      size="sm"
                      onClick={() =>
                        setReviewChoices((prev) => ({ ...prev, [key]: "KEEP_BOTH" }))
                      }
                    >
                      <SplitSquareVertical className="mr-1.5 h-3.5 w-3.5" />
                      Mantener ambas
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <Narrator>{narratorLine}</Narrator>

      <WizardActionBar
        formAction={formAction}
        formExtras={<input type="hidden" name="payload" value={serializedPayload} />}
      >
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
            `Confirmar ${transactions.length} ${
              transactions.length === 1 ? "movimiento" : "movimientos"
            }`
          )}
        </Button>
      </WizardActionBar>
    </div>
  );
}

function Panel({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/6 bg-z-surface-2/65 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <h3 className="text-sm font-semibold text-z-white">{title}</h3>
      {caption && (
        <p className="mt-1 text-xs italic text-z-sage-dark">{caption}</p>
      )}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-white/6 bg-z-surface-2/40 px-3 py-6 text-center text-xs italic text-z-sage-dark">
      {children}
    </p>
  );
}
