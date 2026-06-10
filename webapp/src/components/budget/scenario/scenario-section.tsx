"use client";

import { createContext, useContext, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useHideTabBar } from "@/components/mobile/v2/tab-bar-visibility-provider";
import { cn } from "@/lib/utils";
import type { BudgetScenarioDraft } from "@zeta/shared";
import { deleteBudgetScenario, type BudgetScenarioRecord } from "@/actions/budget-scenarios";
import { createDraft, type ScenarioCategoryOption, type ScenarioDeseoOption, type ScenarioTemplate } from "./scenario-model";
import { ScenarioEntryButton, ScenarioEntrySheet, SavedScenarios } from "./scenario-entry";
import type { CurrencyCode } from "@/types/domain";

const ScenarioSandbox = dynamic(
  () => import("./scenario-sandbox").then((m) => ({ default: m.ScenarioSandbox })),
  {
    ssr: false,
    loading: () => (
      <div className="mx-4 mt-4 h-72 animate-pulse rounded-2xl bg-z-surface-2 lg:mx-auto lg:max-w-md" />
    ),
  },
);

function ModeToggle({
  mode,
  onChange,
}: {
  mode: "real" | "scen";
  onChange: (mode: "real" | "scen") => void;
}) {
  return (
    <div className="flex gap-1 rounded-xl border border-white/6 bg-black/25 p-0.5">
      <button
        type="button"
        onClick={() => onChange("real")}
        className={cn(
          "h-9 flex-1 rounded-lg text-xs font-semibold transition-colors",
          mode === "real"
            ? "border border-z-brass/35 bg-z-surface-3 text-foreground"
            : "text-z-sage-dark",
        )}
      >
        Real
      </button>
      <button
        type="button"
        onClick={() => onChange("scen")}
        className={cn(
          "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors",
          mode === "scen"
            ? "border border-z-alert/35 bg-z-alert/12 text-z-alert"
            : "text-z-sage-dark",
        )}
      >
        <span
          className={cn("size-1.5 rounded-full", mode === "scen" ? "bg-z-alert" : "bg-z-sage-dark")}
        />
        Simulación
      </button>
    </div>
  );
}

// ─── Context: lets the server layout place the entry point inside its flow ───

interface ScenarioContextValue {
  hasDraft: boolean;
  mode: "real" | "scen";
  scenarios: BudgetScenarioRecord[];
  income: number;
  cushion: number;
  currency: CurrencyCode;
  openEntry: () => void;
  setMode: (mode: "real" | "scen") => void;
  continueSaved: (record: BudgetScenarioRecord) => void;
  deleteSaved: (id: string) => void;
}

const ScenarioContext = createContext<ScenarioContextValue | null>(null);

/**
 * Rendered by the server layout wherever the "Simular un cambio" affordance
 * belongs (under the hero on mobile, top of content on desktop). Shows the
 * entry button + saved drafts, or the Real/Simulación toggle once a draft exists.
 */
export function ScenarioEntryPoint({ className }: { className?: string }) {
  const ctx = useContext(ScenarioContext);
  if (!ctx) return null;

  if (ctx.hasDraft) {
    return (
      <div className={className}>
        <ModeToggle mode={ctx.mode} onChange={ctx.setMode} />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <ScenarioEntryButton onClick={ctx.openEntry} />
      <SavedScenarios
        scenarios={ctx.scenarios}
        income={ctx.income}
        cushion={ctx.cushion}
        currency={ctx.currency}
        onContinue={ctx.continueSaved}
        onDelete={ctx.deleteSaved}
      />
    </div>
  );
}

// ─── Root orchestrator (single instance for mobile + desktop) ────────────────

export function ScenarioSection({
  categories,
  deseos,
  scenarios,
  income,
  cushion,
  currency,
  children,
}: {
  categories: ScenarioCategoryOption[];
  deseos: ScenarioDeseoOption[];
  scenarios: BudgetScenarioRecord[];
  income: number;
  cushion: number;
  currency: CurrencyCode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [draft, setDraft] = useState<BudgetScenarioDraft | null>(null);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<"real" | "scen">("real");
  const [appliedCutIds, setAppliedCutIds] = useState<string[]>([]);
  const [entryOpen, setEntryOpen] = useState(false);

  const active = draft != null && mode === "scen";
  useHideTabBar(active);

  const startTemplate = (template: ScenarioTemplate) => {
    setDraft(createDraft(template, categories, currency));
    setScenarioId(null);
    setDirty(true);
    setAppliedCutIds([]);
    setEntryOpen(false);
    setMode("scen");
  };

  const continueSaved = (record: BudgetScenarioRecord) => {
    setDraft(record.draft);
    setScenarioId(record.id);
    setDirty(false);
    setAppliedCutIds([]);
    setMode("scen");
  };

  const exitScenario = () => {
    setDraft(null);
    setScenarioId(null);
    setDirty(false);
    setAppliedCutIds([]);
    setMode("real");
  };

  const deleteSaved = (id: string) => {
    startTransition(async () => {
      const result = await deleteBudgetScenario(id);
      if (result.success) {
        toast.success("Simulación eliminada");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  if (income <= 0) return <>{children}</>;

  return (
    <ScenarioContext.Provider
      value={{
        hasDraft: draft != null,
        mode,
        scenarios,
        income,
        cushion,
        currency,
        openEntry: () => setEntryOpen(true),
        setMode,
        continueSaved,
        deleteSaved,
      }}
    >
      <div className={cn(active && "hidden")}>{children}</div>

      {active && draft && (
        <ScenarioSandbox
          draft={draft}
          scenarioId={scenarioId}
          dirty={dirty}
          income={income}
          cushion={cushion}
          currency={currency}
          categories={categories}
          deseos={deseos}
          appliedCutIds={appliedCutIds}
          modeToggle={<ModeToggle mode={mode} onChange={setMode} />}
          onDraftChange={(next) => {
            setDraft(next);
            setDirty(true);
          }}
          onCutApplied={(categoryId) => setAppliedCutIds((ids) => [...ids, categoryId])}
          onSaved={(id, named) => {
            setScenarioId(id);
            setDraft(named);
            setDirty(false);
          }}
          onExit={exitScenario}
        />
      )}

      <ScenarioEntrySheet
        open={entryOpen}
        onOpenChange={setEntryOpen}
        onPickTemplate={startTemplate}
      />
    </ScenarioContext.Provider>
  );
}
