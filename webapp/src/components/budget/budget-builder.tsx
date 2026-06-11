"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
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
import { CategoryIcon } from "@/components/categories/category-icon";
import { BudgetGroupLines } from "./budget-group-lines";
import { applyBudgetComposition } from "@/actions/budgets";
import { createCategory } from "@/actions/categories";
import { computeCompositionDiff } from "@/lib/utils/budget-rollup";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { BRASS_BUTTON_CLASS, PANEL_INSET_CLASS } from "@/lib/constants/styles";
import type { CategoryBudgetData, CurrencyCode } from "@/types/domain";

const BACK_TARGET = "/plan?tab=presupuesto";

interface BudgetBuilderProps {
  groups: CategoryBudgetData[];
  income: number;
  currency: CurrencyCode;
}

function initialDraft(groups: CategoryBudgetData[]): Record<string, string> {
  const draft: Record<string, string> = {};
  for (const g of groups) {
    if (g.baseBudget && g.baseBudget > 0) draft[g.id] = String(g.baseBudget);
    for (const [childId, amount] of Object.entries(g.childBudgets)) {
      draft[childId] = String(amount);
    }
  }
  return draft;
}

function toNumberMap(draft: Record<string, string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, v] of Object.entries(draft)) out[id] = parseFloat(v) || 0;
  return out;
}

export function BudgetBuilder({ groups, income, currency }: BudgetBuilderProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const initial = useMemo(() => toNumberMap(initialDraft(groups)), [groups]);
  const [draft, setDraft] = useState<Record<string, string>>(() => initialDraft(groups));
  const [openId, setOpenId] = useState<string | null>(groups[0]?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [exitConfirm, setExitConfirm] = useState(false);
  // Subcategories created inline during this session, newest appended.
  const [createdSubs, setCreatedSubs] = useState<Record<string, { parentId: string; name: string }>>({});

  const diff = useMemo(
    () => computeCompositionDiff(initial, toNumberMap(draft)),
    [initial, draft]
  );
  const dirty = diff.upserts.length > 0 || diff.deletes.length > 0;

  function groupWithCreated(g: CategoryBudgetData): CategoryBudgetData {
    type Child = CategoryBudgetData["children"][number];
    const extras = Object.entries(createdSubs)
      .filter(([, meta]) => meta.parentId === g.id)
      // Minimal stub: BudgetGroupLines only reads id / name / name_es from children.
      .map(([id, meta]) =>
        ({ id, name: meta.name, name_es: meta.name, parent_id: g.id, children: [] }) as unknown as Child
      );
    if (extras.length === 0) return g;
    return { ...g, children: [...g.children, ...extras] };
  }

  function groupTotal(g: CategoryBudgetData): number {
    const base = parseFloat(draft[g.id] ?? "") || 0;
    const childSum = groupWithCreated(g).children.reduce(
      (s, c) => s + (parseFloat(draft[c.id] ?? "") || 0),
      0
    );
    return base + childSum;
  }

  const total = groups.reduce((s, g) => s + groupTotal(g), 0);
  const remaining = income - total;

  const sortedGroups = useMemo(
    () =>
      [...groups].sort(
        (a, b) => Number((b.budget ?? 0) > 0) - Number((a.budget ?? 0) > 0)
      ),
    [groups]
  );

  function setLine(categoryId: string, amount: string) {
    setDraft((prev) => ({ ...prev, [categoryId]: amount }));
  }

  async function handleCreateSub(parentId: string, name: string): Promise<string | null> {
    const slug = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const fd = new FormData();
    fd.append("name", name);
    fd.append("name_es", name);
    fd.append("slug", `${slug}-${Date.now().toString(36)}`);
    fd.append("direction", "OUTFLOW");
    fd.append("parent_id", parentId);
    const result = await createCategory({ success: false, error: "" }, fd);
    if (!result.success) {
      toast.error(result.error || "No se pudo crear la línea");
      return null;
    }
    setCreatedSubs((prev) => ({ ...prev, [result.data.id]: { parentId, name } }));
    return result.data.id;
  }

  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const result = await applyBudgetComposition(diff);
      if (!result.success) {
        toast.error(result.error || "No se pudo guardar el presupuesto");
        return;
      }
      toast.success("Presupuesto guardado");
      startTransition(() => router.push(BACK_TARGET));
    } finally {
      setSaving(false);
    }
  }

  function handleExit() {
    if (dirty) setExitConfirm(true);
    else router.push(BACK_TARGET);
  }

  return (
    <div className="pb-8">
      <MobileHeader
        variant="sub"
        title="Armar presupuesto"
        backStyle="exit"
        onBackClick={handleExit}
      />

      <div className="space-y-3 pt-4 lg:mx-auto lg:max-w-md">
        <div className="hidden items-center justify-between lg:flex">
          <h2 className="text-2xl font-semibold">Armar presupuesto</h2>
          <button
            type="button"
            onClick={handleExit}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Salir
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Arma cada grupo por líneas: lo fijo viene de tus recurrentes, lo variable de tus
          promedios. La suma define el límite del grupo.
        </p>

        {sortedGroups.map((g) => {
          const open = openId === g.id;
          const totalG = groupTotal(g);
          const enriched = groupWithCreated(g);
          return (
            <section
              key={g.id}
              className={cn(PANEL_INSET_CLASS, "p-3", open && "border-z-brass/30")}
            >
              <button
                type="button"
                onClick={() => setOpenId(open ? null : g.id)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="flex size-6 shrink-0 items-center justify-center rounded-md"
                    style={{ backgroundColor: `${g.color}20`, color: g.color }}
                  >
                    <CategoryIcon icon={g.icon} className="size-3.5" />
                  </span>
                  <span className="truncate text-sm font-semibold">{g.name_es ?? g.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="text-sm font-semibold tabular-nums text-z-brass">
                    {totalG > 0 ? formatCurrency(totalG, currency) : "—"}
                  </span>
                  {open ? (
                    <ChevronDown className="size-3.5 text-z-sage-dark" strokeWidth={1.5} />
                  ) : (
                    <ChevronRight className="size-3.5 text-z-sage-dark" strokeWidth={1.5} />
                  )}
                </span>
              </button>

              {open && (
                <div className="mt-3">
                  <BudgetGroupLines
                    group={enriched}
                    currency={currency}
                    draft={draft}
                    onChange={setLine}
                    onAddLine={(id, prefill) => setLine(id, prefill)}
                    onCreateSub={(name) => handleCreateSub(g.id, name)}
                  />
                </div>
              )}
            </section>
          );
        })}

        {/* Sticky total */}
        <div className="sticky bottom-2 z-10 space-y-2 rounded-xl border border-z-brass/35 bg-z-surface-2/95 p-3 backdrop-blur-sm">
          <div className="flex items-baseline justify-between gap-2 text-sm font-semibold">
            <span className="tabular-nums">
              Σ {formatCurrency(total, currency)}
              {income > 0 && (
                <span className="font-normal text-muted-foreground">
                  {" "}de {formatCurrency(income, currency)}
                </span>
              )}
            </span>
            {income > 0 && (
              <span
                className={cn(
                  "shrink-0 text-xs tabular-nums",
                  remaining < 0 ? "text-z-debt" : "text-z-income"
                )}
              >
                {remaining < 0
                  ? `te pasas ${formatCurrency(-remaining, currency)}`
                  : `quedan ${formatCurrency(remaining, currency)}`}
              </span>
            )}
          </div>
          {income > 0 && (
            <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
              <div
                className={cn(
                  "h-full rounded-full",
                  total > income ? "bg-z-debt" : "bg-z-brass"
                )}
                style={{ width: `${Math.min(100, (total / income) * 100)}%` }}
              />
            </div>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className={cn(
              "h-10 w-full rounded-md text-sm font-semibold transition-colors disabled:opacity-50",
              BRASS_BUTTON_CLASS
            )}
          >
            {saving ? "Guardando..." : "Guardar presupuesto"}
          </button>
        </div>
      </div>

      <AlertDialog open={exitConfirm} onOpenChange={setExitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar cambios?</AlertDialogTitle>
            <AlertDialogDescription>
              Tienes líneas sin guardar. Si sales ahora, se pierden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction onClick={() => router.push(BACK_TARGET)}>
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
