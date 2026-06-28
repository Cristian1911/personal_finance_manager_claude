"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Plus, Minus } from "lucide-react";
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
import { BudgetTxPickerSheet } from "./budget-tx-picker-sheet";
import { BudgetCategoryAddSheet } from "./budget-category-add-sheet";
import { applyBudgetComposition } from "@/actions/budgets";
import { setBudgetMode } from "@/actions/budget";
import { createCategory } from "@/actions/categories";
import { computeCompositionDiff } from "@/lib/utils/budget-rollup";
import { groupCategoriesByAllocationSet } from "@/lib/utils/allocation-sets";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { BRASS_BUTTON_CLASS, BRASS_GHOST_BUTTON_CLASS, PANEL_INSET_CLASS, SECTION_EYEBROW_CLASS } from "@/lib/constants/styles";
import type { CategoryBudgetData, CurrencyCode, BudgetMode } from "@/types/domain";

const BACK_TARGET = "/plan?tab=presupuesto";

interface BudgetBuilderProps {
  groups: CategoryBudgetData[];
  income: number;
  currency: CurrencyCode;
  hasUncategorized: boolean;
  mode: BudgetMode;
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

export function BudgetBuilder({ groups, income, currency, hasUncategorized, mode }: BudgetBuilderProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const initial = useMemo(() => toNumberMap(initialDraft(groups)), [groups]);
  const [draft, setDraft] = useState<Record<string, string>>(() => initialDraft(groups));
  const [openId, setOpenId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exitConfirm, setExitConfirm] = useState(false);
  // Subcategories created inline during this session, newest appended.
  const [createdSubs, setCreatedSubs] = useState<Record<string, { parentId: string; name: string }>>({});
  const [picker, setPicker] = useState<{ id: string; name: string } | null>(null);
  const [addPicker, setAddPicker] = useState<{ title: string; categories: CategoryBudgetData[] } | null>(null);

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

  const isActive = useCallback(
    (g: CategoryBudgetData) =>
      draft[g.id] !== undefined ||
      (parseFloat(draft[g.id] ?? "") || 0) > 0 ||
      g.children.some((c) => draft[c.id] !== undefined),
    [draft]
  );
  const activeGroups = useMemo(() => sortedGroups.filter(isActive), [sortedGroups, isActive]);
  const availableGroups = useMemo(() => sortedGroups.filter((g) => !isActive(g)), [sortedGroups, isActive]);

  function setLine(categoryId: string, amount: string) {
    setDraft((prev) => ({ ...prev, [categoryId]: amount }));
  }

  function removeLine(categoryId: string) {
    setDraft((prev) => {
      const next = { ...prev };
      delete next[categoryId];
      return next;
    });
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
      // Persist the budget mode only now — a real budget was saved. If the
      // mode write fails the budget itself is still saved, so navigate anyway
      // but surface the partial failure (otherwise plan-tab would re-gate to
      // the wizard on the next visit).
      const modeRes = await setBudgetMode(mode);
      toast[modeRes.success ? "success" : "error"](
        modeRes.success
          ? "Presupuesto guardado"
          : "Presupuesto guardado, pero no se pudo guardar el modo"
      );
      startTransition(() => router.push(BACK_TARGET));
    } finally {
      setSaving(false);
    }
  }

  function handleExit() {
    if (dirty) setExitConfirm(true);
    else router.push(BACK_TARGET);
  }

  // 50/30/20 mode groups categories into 3 sets with salary-based caps.
  // Caps need an income; without one we fall back to the flat list.
  const allocationSets =
    mode === "50_30_20" && income > 0
      ? groupCategoriesByAllocationSet(groups, income)
      : null;

  function renderGroup(g: CategoryBudgetData) {
    const open = openId === g.id;
    const totalG = groupTotal(g);
    const enriched = groupWithCreated(g);
    return (
      <section
        key={g.id}
        className={cn(PANEL_INSET_CLASS, "p-3", open && "border-z-brass/30")}
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOpenId(open ? null : g.id)}
            aria-expanded={open}
            className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
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
              {totalG > 0 && (
                <span className="text-sm font-semibold tabular-nums text-z-brass">
                  {formatCurrency(totalG, currency)}
                </span>
              )}
              {open ? (
                <ChevronDown className="size-3.5 text-z-sage-dark" strokeWidth={1.5} />
              ) : (
                <ChevronRight className="size-3.5 text-z-sage-dark" strokeWidth={1.5} />
              )}
            </span>
          </button>
          <button
            type="button"
            onClick={() => removeCategory(g)}
            aria-label={`Quitar ${g.name_es ?? g.name}`}
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-z-sage-dark transition-colors hover:bg-z-debt/10 hover:text-z-debt"
          >
            <Minus className="size-4" strokeWidth={2} />
          </button>
        </div>

        {open && (
          <div className="mt-3">
            <BudgetGroupLines
              group={enriched}
              currency={currency}
              draft={draft}
              onChange={setLine}
              onAddLine={(id, prefill) => setLine(id, prefill)}
              onRemoveLine={removeLine}
              onCreateSub={(name) => handleCreateSub(g.id, name)}
              onPickFromTransactions={(id, name) => setPicker({ id, name })}
              hasUncategorized={hasUncategorized}
            />
          </div>
        )}
      </section>
    );
  }

  function addCategory(categoryId: string) {
    setLine(categoryId, "");
    setOpenId(categoryId);
  }

  // Remove a whole category from the budget: clears its base + every line so it
  // drops back to "available" (re-addable from the picker).
  function removeCategory(g: CategoryBudgetData) {
    setDraft((prev) => {
      const next = { ...prev };
      delete next[g.id];
      for (const c of groupWithCreated(g).children) delete next[c.id];
      return next;
    });
    setOpenId((cur) => (cur === g.id ? null : cur));
  }

  // Progressive disclosure: one quiet row instead of the chip wall. Opens a
  // picker with the available categories (per set, or all in flat mode).
  function renderAddRow(avail: CategoryBudgetData[], title: string) {
    if (avail.length === 0) return null;
    return (
      <button
        type="button"
        onClick={() => setAddPicker({ title, categories: avail })}
        className={cn(
          BRASS_GHOST_BUTTON_CLASS,
          "flex w-full items-center gap-2 rounded-xl border border-dashed px-3 py-2.5 text-left text-[12.5px] font-medium transition-colors"
        )}
      >
        <span className="flex size-5 items-center justify-center rounded-md bg-z-brass/12">
          <Plus className="size-3" strokeWidth={2.5} />
        </span>
        Agregar categoría
      </button>
    );
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
          Presupuesta <span className="text-z-income">solo lo que te importa</span> — no tienes que llenar todo.
        </p>

        {/* Sticky progress — always visible, no scroll needed */}
        <div className="sticky top-2 z-10 space-y-2 rounded-xl border border-white/6 bg-z-surface-2/95 p-3 backdrop-blur-sm">
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
        </div>

        {activeGroups.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aún no presupuestas nada. Agrega las categorías que te importan abajo.
          </p>
        )}

        {allocationSets ? (
          allocationSets.map((s) => {
            const setActive = s.groups.filter(isActive);
            const setAvail = s.groups.filter((g) => !isActive(g));
            const assigned = setActive.reduce((sum, g) => sum + groupTotal(g), 0);
            const over = assigned > s.cap;
            const pct = Math.round((s.cap / income) * 100);
            return (
              <div key={s.set} className="space-y-2 pt-1">
                {/* Set header — eyebrow + thin cap bar (calm, not a card) */}
                <div className="space-y-1 px-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={SECTION_EYEBROW_CLASS}>
                      {s.label} · {pct}%
                    </p>
                    <span
                      className={cn(
                        "text-[11px] tabular-nums",
                        over ? "text-z-debt" : "text-z-income"
                      )}
                    >
                      {formatCurrency(assigned, currency)} / {formatCurrency(s.cap, currency)}
                    </span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-white/6">
                    <div
                      className={cn("h-full rounded-full", over ? "bg-z-debt" : "bg-z-brass")}
                      style={{ width: `${s.cap > 0 ? Math.min(100, (assigned / s.cap) * 100) : 0}%` }}
                    />
                  </div>
                </div>
                {setActive.map(renderGroup)}
                {renderAddRow(setAvail, `Agregar a ${s.label}`)}
              </div>
            );
          })
        ) : (
          <>
            {activeGroups.map(renderGroup)}
            {renderAddRow(availableGroups, "Agregar categoría")}
          </>
        )}

        {/* Sticky save */}
        <div className="sticky bottom-2 z-10 rounded-xl border border-white/6 bg-z-surface-2/95 p-3 backdrop-blur-sm">
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

      {picker && (
        <BudgetTxPickerSheet
          open={!!picker}
          onOpenChange={(o) => { if (!o) setPicker(null); }}
          targetCategoryId={picker.id}
          targetCategoryName={picker.name}
          currency={currency}
          onConfirm={(sum) => { setLine(picker.id, String(sum)); setPicker(null); }}
        />
      )}

      {addPicker && (
        <BudgetCategoryAddSheet
          open={!!addPicker}
          onOpenChange={(o) => { if (!o) setAddPicker(null); }}
          title={addPicker.title}
          categories={addPicker.categories}
          onPick={addCategory}
        />
      )}

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
