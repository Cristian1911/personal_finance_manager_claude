"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { cn } from "@/lib/utils";
import { MOBILE_SHEET_SAFE_AREA_CLASS } from "@/lib/constants/styles";
import {
  applyCutToDraft,
  computeCutCandidates,
  computeDeferCandidates,
  computeScenarioSummary,
  type BudgetScenarioDraft,
} from "@zeta/shared";
import { saveBudgetScenario, applyBudgetScenario } from "@/actions/budget-scenarios";
import { cutStep, lineFromCategory, type ScenarioCategoryOption, type ScenarioDeseoOption } from "./scenario-model";
import { ScenarioHero } from "./scenario-hero";
import { ScenarioEditor, ScenarioEditorFooter } from "./scenario-editor";
import { ScenarioVerdict } from "./scenario-verdict";
import { ScenarioStartup } from "./scenario-startup";
import { ScenarioSaveSheet, ScenarioApplySheet } from "./scenario-commit";
import { normalizeVerdict } from "./scenario-model";
import type { CurrencyCode } from "@/types/domain";

export interface ScenarioSandboxProps {
  draft: BudgetScenarioDraft;
  scenarioId: string | null;
  dirty: boolean;
  income: number;
  cushion: number;
  currency: CurrencyCode;
  categories: ScenarioCategoryOption[];
  deseos: ScenarioDeseoOption[];
  appliedCutIds: string[];
  modeToggle: React.ReactNode;
  onDraftChange: (next: BudgetScenarioDraft) => void;
  onCutApplied: (categoryId: string) => void;
  onSaved: (id: string, named: BudgetScenarioDraft) => void;
  onExit: () => void;
}

export function ScenarioSandbox({
  draft,
  scenarioId,
  dirty,
  income,
  cushion,
  currency,
  categories,
  deseos,
  appliedCutIds,
  modeToggle,
  onDraftChange,
  onCutApplied,
  onSaved,
  onExit,
}: ScenarioSandboxProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saveOpen, setSaveOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const summary = useMemo(
    () => computeScenarioSummary(draft, income, cushion),
    [draft, income, cushion],
  );
  const cuts = useMemo(() => computeCutCandidates(draft, cutStep(currency)), [draft, currency]);
  const defers = useMemo(() => computeDeferCandidates(draft, cushion), [draft, cushion]);

  const updateStartup = (patch: Partial<BudgetScenarioDraft["startup"]>) =>
    onDraftChange({ ...draft, startup: { ...draft.startup, ...patch } });
  const patchItem = (itemId: string, patch: { deferred: boolean }) =>
    updateStartup({
      items: draft.startup.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
    });

  const handleSave = (name: string) => {
    const named = { ...draft, name };
    startTransition(async () => {
      const result = await saveBudgetScenario({ id: scenarioId, draft: named });
      if (result.success) {
        setSaveOpen(false);
        onSaved(result.data.id, named);
        toast.success("Simulación guardada");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleApply = () => {
    startTransition(async () => {
      const result = await applyBudgetScenario({ id: scenarioId, draft });
      if (result.success) {
        setApplyOpen(false);
        onExit();
        toast.success("Escenario aplicado a tu presupuesto");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div>
      <div className="lg:hidden">
        <MobileHeader variant="sub" title="Simulación" backHref="/plan" />
      </div>

      <div
        className={cn(
          "space-y-4 px-4 pt-4 lg:mx-auto lg:max-w-md lg:px-0 lg:pt-0 pb-8",
          MOBILE_SHEET_SAFE_AREA_CLASS,
        )}
      >
        {modeToggle}

        <ScenarioHero
          name={draft.name}
          summary={summary}
          income={income}
          currency={currency}
          dirty={dirty}
          onDiscard={() => (dirty ? setDiscardOpen(true) : onExit())}
          onSave={() => setSaveOpen(true)}
          onApply={() => setApplyOpen(true)}
        />

        <ScenarioVerdict
          summary={summary}
          income={income}
          cuts={cuts}
          defers={defers}
          appliedCutIds={appliedCutIds}
          currency={currency}
          onApplyCut={(cut) => {
            onDraftChange(applyCutToDraft(draft, cut));
            onCutApplied(cut.categoryId);
          }}
          onDeferItem={(itemId) => patchItem(itemId, { deferred: true })}
        />

        <ScenarioEditor
          lines={draft.lines}
          currency={currency}
          categories={categories}
          onChangeLine={(categoryId, amount) =>
            onDraftChange({
              ...draft,
              lines: draft.lines.map((l) =>
                l.categoryId === categoryId ? { ...l, scenario: amount } : l,
              ),
            })
          }
          onAddCategory={(cat) =>
            onDraftChange({
              ...draft,
              lines: [lineFromCategory({ ...cat, budget: null }, 0), ...draft.lines],
            })
          }
        />

        <ScenarioStartup
          draft={draft}
          cushion={cushion}
          deseos={deseos}
          currency={currency}
          onSetRate={(rate) => updateStartup({ monthlyRate: rate })}
          onToggleCushion={() => updateStartup({ useCushion: !draft.startup.useCushion })}
          onAddItem={({ name, amount, deseo }) =>
            updateStartup({
              items: [
                ...draft.startup.items,
                {
                  id: crypto.randomUUID(),
                  name,
                  amount,
                  verdict: deseo ? normalizeVerdict(deseo.verdict) : null,
                  wishlistItemId: deseo?.id ?? null,
                  deferred: false,
                },
              ],
            })
          }
          onToggleDefer={(itemId) => {
            const item = draft.startup.items.find((i) => i.id === itemId);
            if (item) patchItem(itemId, { deferred: !item.deferred });
          }}
        />

        <ScenarioEditorFooter total={summary.scenarioTotal} income={income} currency={currency} />
      </div>

      <ScenarioSaveSheet
        open={saveOpen}
        onOpenChange={setSaveOpen}
        draft={draft}
        summary={summary}
        currency={currency}
        saving={isPending}
        onSave={handleSave}
        onApplyInstead={() => {
          setSaveOpen(false);
          setApplyOpen(true);
        }}
      />
      <ScenarioApplySheet
        open={applyOpen}
        onOpenChange={setApplyOpen}
        draft={draft}
        summary={summary}
        income={income}
        currency={currency}
        applying={isPending}
        onConfirm={handleApply}
      />

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar la simulación?</AlertDialogTitle>
            <AlertDialogDescription>
              {scenarioId
                ? "Los cambios sin guardar se pierden. El borrador guardado queda como estaba."
                : "Esta simulación no está guardada — se pierde por completo."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDiscardOpen(false);
                onExit();
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
