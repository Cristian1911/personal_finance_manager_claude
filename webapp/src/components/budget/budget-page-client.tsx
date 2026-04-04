"use client";

import {
  useState,
  useMemo,
  useTransition,
  useRef,
  useEffect,
  Suspense,
} from "react";
import { useRouter } from "next/navigation";
import { Settings2, Feather, Gauge, Check, Plus, AlertTriangle, ChevronDown, Pencil, Repeat } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { CategoryIcon } from "@/components/categories/category-icon";
import { CurrencyInput } from "@/components/ui/currency-input";
import { MonthSelector } from "@/components/month-selector";
import { Button } from "@/components/ui/button";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { HeroAccentPill, HeroPill, PageHero } from "@/components/ui/page-hero";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  setBudgetMode,
  updateEstimatedIncome,
  upsertBudgetForCategory,
} from "@/actions/budget";
import { cn } from "@/lib/utils";
import {
  GHOST_BUTTON_CLASS,
  PAGE_STACK_CLASS,
  PANEL_INSET_CLASS,
  PANEL_SURFACE_CLASS,
  PANEL_SURFACE_SUBTLE_CLASS,
} from "@/lib/constants/styles";
import { BudgetTreemap } from "./budget-treemap";
import type { BudgetMode, CategoryBudgetData, CurrencyCode } from "@/types/domain";
import type { AllocationData } from "@/actions/allocation";

interface BudgetPageClientProps {
  mode: BudgetMode;
  categories: CategoryBudgetData[];
  income: number;
  currency: CurrencyCode;
  monthLabel: string;
  allocationData: AllocationData | null;
  daysRemaining: number;
}

// ── Main Component ───────────────────────────────────────────

export function BudgetPageClient({
  mode,
  categories,
  income,
  currency,
  monthLabel,
  allocationData,
  daysRemaining,
}: BudgetPageClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isStrict = mode === "zero_based";

  // ── Budget amounts (optimistic local state) ──
  const outflowCategories = useMemo(
    () => categories.filter((c) => c.direction === "OUTFLOW"),
    [categories],
  );

  const [budgetAmounts, setBudgetAmounts] = useState<Record<string, number>>(
    () => {
      const map: Record<string, number> = {};
      for (const cat of outflowCategories) {
        if (cat.budget !== null && cat.budget > 0) {
          map[cat.id] = cat.budget;
        }
      }
      return map;
    },
  );

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const assigned = useMemo(
    () => Object.values(budgetAmounts).reduce((s, v) => s + v, 0),
    [budgetAmounts],
  );
  const remaining = income - assigned;

  // ── Days / month progress for pacing ──
  const today = new Date();
  const daysInMonth =
    new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const monthProgress = daysInMonth > 0 ? (daysInMonth - daysRemaining) / daysInMonth : 1;

  // ── Actions ──
  function handleModeSwitch() {
    const newMode: BudgetMode = isStrict ? "per_category" : "zero_based";
    startTransition(async () => {
      await setBudgetMode(newMode);
      router.refresh();
    });
  }

  function handleIncomeUpdate(amount: number) {
    startTransition(async () => {
      await updateEstimatedIncome(amount);
      router.refresh();
    });
  }

  function handleSave(categoryId: string, amount: number) {
    setEditingId(null);
    setBudgetAmounts((prev) => {
      if (amount <= 0) {
        const next = { ...prev };
        delete next[categoryId];
        return next;
      }
      return { ...prev, [categoryId]: amount };
    });
    startTransition(async () => {
      await upsertBudgetForCategory(categoryId, amount);
    });
  }

  // ── Labels ──
  const styleLabel = isStrict ? "Estricto" : "Flexible";
  const otherStyleLabel = isStrict ? "Flexible" : "Estricto";
  const StyleIcon = isStrict ? Gauge : Feather;
  const thirdCardLabel = isStrict ? "Por asignar" : "Libre";
  const heroDescription = remaining < 0
    ? `Tu plan del mes quedó sobre-asignado por ${formatCurrency(Math.abs(remaining), currency)}. Ajusta antes de bajar al detalle.`
    : isStrict
      ? `Cada peso necesita destino. ${formatCurrency(remaining, currency)} siguen esperando una decisión para cerrar ${monthLabel}.`
      : `Tu marco mensual ya está armado. Revisa qué categorías sostienen el plan y cuáles empiezan a desordenarlo.`;

  return (
    <div className={PAGE_STACK_CLASS}>
      <PageHero
        variant={remaining < 0 ? "brass" : "sage"}
        pills={
          <>
            <HeroPill>Presupuesto</HeroPill>
            <HeroAccentPill>
              <span className="inline-flex items-center gap-1.5">
                <StyleIcon className="size-3.5" />
                {styleLabel}
              </span>
            </HeroAccentPill>
            <HeroPill>{monthLabel}</HeroPill>
          </>
        }
        title="Tu plan mensual"
        description={heroDescription}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Suspense>
              <MonthSelector />
            </Suspense>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  className={GHOST_BUTTON_CLASS}
                >
                  <Settings2 className="size-4 mr-2" />
                  Ajustes
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 space-y-3">
                <div>
                  <p className="text-sm font-medium">Estilo</p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Actualmente: {styleLabel}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleModeSwitch}
                    disabled={isPending}
                  >
                    Cambiar a {otherStyleLabel}
                  </Button>
                </div>
                <IncomeEditor
                  currentIncome={income}
                  currency={currency}
                  onSave={handleIncomeUpdate}
                  isPending={isPending}
                />
              </PopoverContent>
            </Popover>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <SummaryCard label="Ingreso" value={income} currency={currency} />
          <SummaryCard label="Asignado" value={assigned} currency={currency} />
          <SummaryCard
            label={thirdCardLabel}
            value={remaining}
            currency={currency}
            negative={remaining < 0}
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-z-brass" />
          <span>{daysRemaining} días restantes para cerrar {monthLabel}</span>
        </div>
      </PageHero>

      {/* ── Strict mode: Sticky remaining-to-assign bar ── */}
      {isStrict && (
        <StickyAssignmentBar
          income={income}
          assigned={assigned}
          remaining={remaining}
          currency={currency}
        />
      )}

      {/* ── 50/30/20 Allocation Reference ── */}
      {allocationData && (
        <AllocationReference data={allocationData} />
      )}

      {/* ── Treemap overview ── */}
      <BudgetTreemap
        categories={categories}
        budgetAmounts={budgetAmounts}
        currency={currency}
        onCategoryClick={(id) => setExpandedId(expandedId === id ? null : id)}
      />

      {/* ── Category grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {outflowCategories.map((cat) => {
          const budget = budgetAmounts[cat.id] ?? 0;
          const ratio = budget > 0 ? cat.spent / budget : 0;
          const barColor =
            budget === 0
              ? "bg-muted-foreground/30"
              : ratio > 1
                ? "bg-red-500"
                : ratio >= 0.75
                  ? "bg-yellow-500"
                  : "bg-emerald-500";

          const pacingDelta = ratio - monthProgress;
          const pacingLabel =
            budget > 0 && pacingDelta > 0.15
              ? "vas por encima del ritmo"
              : budget > 0 && pacingDelta < -0.15
                ? "vas holgado"
                : null;
          const pacingColor =
            pacingLabel === "vas por encima del ritmo"
              ? "text-amber-400"
              : "text-emerald-400";

          const unbudgetedStrict = isStrict && budget === 0;
          const noBudgetLabel = isStrict ? "Sin asignar" : "Sin presupuesto";
          const isExpanded = expandedId === cat.id;
          const isEditing = editingId === cat.id;
          const flexible = budget > 0 ? Math.max(0, budget - cat.committedRecurring) : 0;

          return (
            <div
              key={cat.id}
              className={cn(
                PANEL_SURFACE_CLASS,
                "transition-colors",
                unbudgetedStrict
                  ? "border-z-alert/25 bg-z-alert/[0.06]"
                  : undefined,
              )}
              style={{ borderLeft: `4px solid ${cat.color}` }}
            >
              {/* Clickable header — expands/collapses */}
              <div
                role="button"
                tabIndex={0}
                className="cursor-pointer p-4 hover:bg-white/[0.02] transition-colors"
                onClick={() => {
                  setExpandedId(isExpanded ? null : cat.id);
                  if (isEditing) setEditingId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setExpandedId(isExpanded ? null : cat.id);
                  }
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="flex size-7 shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                    >
                      <CategoryIcon icon={cat.icon} className="size-4" />
                    </span>
                    <span className="truncate text-sm font-medium">
                      {cat.name_es ?? cat.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">
                      {budget > 0
                        ? formatCurrency(budget, currency)
                        : <span className={cn("text-xs font-normal", unbudgetedStrict ? "text-amber-400/80" : "text-muted-foreground")}>{noBudgetLabel}</span>}
                    </span>
                    <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", barColor)}
                    style={{ width: `${Math.min(ratio * 100, 100)}%` }}
                  />
                </div>

                {/* Summary line */}
                <div className="mt-1.5 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {budget > 0 ? (
                      <>
                        {formatCurrency(cat.spent, currency)} gastado de{" "}
                        {formatCurrency(budget, currency)}
                      </>
                    ) : (
                      cat.spent > 0
                        ? <>{formatCurrency(cat.spent, currency)} gastado</>
                        : "Sin movimientos"
                    )}
                  </p>
                  {pacingLabel && (
                    <p className={cn("text-[10px] font-medium", pacingColor)}>
                      {pacingLabel}
                    </p>
                  )}
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-white/6 px-4 pb-4 pt-3 space-y-3">
                  {/* Recurring breakdown */}
                  {cat.committedRecurring > 0 && budget > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Repeat className="size-3.5 shrink-0" />
                      <span>
                        {formatCurrency(cat.committedRecurring, currency)} fijos
                        {flexible > 0 && <> · {formatCurrency(flexible, currency)} flexible</>}
                      </span>
                    </div>
                  )}

                  {/* 3-month average */}
                  {cat.average3m > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Promedio 3 meses</span>
                      <span className="font-medium tabular-nums">
                        {formatCurrency(cat.average3m, currency)}
                      </span>
                    </div>
                  )}

                  {/* Expense type */}
                  {cat.expense_type && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Tipo</span>
                      <span className="font-medium">
                        {cat.expense_type === "fixed" ? "Fijo" : "Variable"}
                      </span>
                    </div>
                  )}

                  {/* Subcategories with spending */}
                  {cat.children.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Subcategorías
                      </p>
                      {cat.children.map((child) => {
                        const childSpent = cat.childrenSpent[child.id] ?? 0;
                        const childRatio = cat.spent > 0 ? childSpent / cat.spent : 0;

                        return (
                          <div key={child.id} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="inline-block size-2 rounded-full shrink-0"
                                  style={{ backgroundColor: cat.color }}
                                />
                                <span className="truncate text-muted-foreground">
                                  {child.name_es ?? child.name}
                                </span>
                              </div>
                              <span className="shrink-0 tabular-nums font-medium">
                                {childSpent > 0
                                  ? formatCurrency(childSpent, currency)
                                  : <span className="text-muted-foreground font-normal">—</span>}
                              </span>
                            </div>
                            {childSpent > 0 && (
                              <div className="h-1 rounded-full bg-muted/50 overflow-hidden ml-4">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${Math.min(childRatio * 100, 100)}%`,
                                    backgroundColor: cat.color,
                                    opacity: 0.7,
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {/* Unassigned spending (directly on parent) */}
                      {(() => {
                        const childTotal = Object.values(cat.childrenSpent).reduce((s, v) => s + v, 0);
                        const directSpent = cat.spent - childTotal;
                        if (directSpent <= 0 || childTotal === 0) return null;
                        const directRatio = cat.spent > 0 ? directSpent / cat.spent : 0;
                        return (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="inline-block size-2 rounded-full shrink-0 bg-muted-foreground/40" />
                                <span className="truncate text-muted-foreground italic">
                                  Sin subcategoría
                                </span>
                              </div>
                              <span className="shrink-0 tabular-nums font-medium">
                                {formatCurrency(directSpent, currency)}
                              </span>
                            </div>
                            <div className="h-1 rounded-full bg-muted/50 overflow-hidden ml-4">
                              <div
                                className="h-full rounded-full bg-muted-foreground/40"
                                style={{ width: `${Math.min(directRatio * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Budget edit action */}
                  {isEditing ? (
                    <InlineBudgetEditor
                      categoryId={cat.id}
                      initialAmount={budget}
                      currency={currency}
                      isEditing
                      onSave={handleSave}
                    />
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-1.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(cat.id);
                      }}
                    >
                      <Pencil className="size-3.5" />
                      {budget > 0 ? "Editar presupuesto" : "Asignar presupuesto"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Sticky Assignment Bar (strict mode) ─────────────────────

function StickyAssignmentBar({
  income,
  assigned,
  remaining,
  currency,
}: {
  income: number;
  assigned: number;
  remaining: number;
  currency: CurrencyCode;
}) {
  const ratio = income > 0 ? Math.min(assigned / income, 1) : 0;
  const overAssigned = remaining < 0;
  const exactZero = remaining === 0 && income > 0;
  const lowRemaining = !overAssigned && !exactZero && income > 0 && remaining / income <= 0.1;

  const barColor = overAssigned
    ? "bg-red-500"
    : exactZero
      ? "bg-emerald-500"
      : lowRemaining
        ? "bg-amber-500"
        : "bg-emerald-500";

  return (
    <div className="sticky top-0 z-10 bg-background pb-2">
      <div className={cn(PANEL_SURFACE_CLASS, "p-4")}>
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 rounded-full bg-z-surface-3">
            <div
              className={cn("h-full rounded-full transition-all", barColor)}
              style={{ width: `${Math.min(ratio * 100, 100)}%` }}
            />
          </div>
          <span className="shrink-0 text-sm font-bold">
            {overAssigned ? (
              <span className="text-red-400">
                {formatCurrency(Math.abs(remaining), currency)} sobre-asignado
              </span>
            ) : exactZero ? (
              <span className="flex items-center gap-1 text-emerald-400">
                <Check className="size-4" />
                Todo asignado
              </span>
            ) : (
              <span
                className={cn(
                  lowRemaining ? "text-amber-400" : "text-foreground",
                )}
              >
                {formatCurrency(remaining, currency)} por asignar
              </span>
            )}
          </span>
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          Ingreso: {formatCurrency(income, currency)}
        </p>
      </div>
    </div>
  );
}

// ── Summary Card ─────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  currency,
  negative,
}: {
  label: string;
  value: number;
  currency: CurrencyCode;
  negative?: boolean;
}) {
  return (
    <div className={cn(PANEL_INSET_CLASS, "bg-black/15 p-4 lg:p-5")}>
      <SectionEyebrow>{label}</SectionEyebrow>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tracking-tight tabular-nums lg:text-[2rem]",
          negative && "text-z-debt",
        )}
      >
        {formatCurrency(value, currency)}
      </p>
    </div>
  );
}

// ── 50/30/20 Allocation Reference ────────────────────────────

function AllocationReference({ data }: { data: AllocationData }) {
  const bars = [
    {
      label: "Necesidades",
      barData: data.needs,
      color: "var(--z-income)",
    },
    {
      label: "Deseos",
      barData: data.wants,
      color: "var(--z-alert)",
    },
    {
      label: "Ahorro/Deuda",
      barData: data.savings,
      color:
        data.savings.percent < data.savings.target
          ? "var(--z-debt)"
          : "var(--z-income)",
    },
  ];

  return (
    <div className={cn(PANEL_SURFACE_SUBTLE_CLASS, "p-4")}>
      <SectionEyebrow className="mb-3 text-muted-foreground">
        Distribución 50/30/20
      </SectionEyebrow>

      {bars.map((bar) => (
        <div key={bar.label} className="mb-4 last:mb-0">
          <div className="flex justify-between text-xs mb-1">
            <span>
              {bar.label}{" "}
              <span className="text-muted-foreground">
                (meta: {bar.barData.target}%)
              </span>
            </span>
            <span
              className={cn(
                "font-bold",
                bar.barData.percent > bar.barData.target + 5
                  ? "text-z-debt"
                  : "",
              )}
            >
              {Math.round(bar.barData.percent)}% ·{" "}
              {formatCurrency(bar.barData.amount, data.currency)}
            </span>
          </div>

          <div className="relative h-4 rounded-md bg-z-surface-3 overflow-hidden">
            <div
              className="h-full rounded-md"
              style={{
                width: `${Math.min(Math.max(bar.barData.percent, 0), 100)}%`,
                background: bar.color,
              }}
            />
            {/* Target dashed line */}
            <div
              className="absolute top-0 h-full border-l-2 border-dashed border-white/30"
              style={{ left: `${bar.barData.target}%` }}
            />
          </div>
        </div>
      ))}

      {data.untaggedCategories > 0 && (
        <p className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground">
          <AlertTriangle className="size-3 text-amber-400" />
          {data.untaggedCategories} categor{data.untaggedCategories === 1 ? "ía sin" : "ías sin"}{" "}
          tipo asignado — afecta precisión
        </p>
      )}
    </div>
  );
}

// ── Inline Budget Editor ─────────────────────────────────────

function InlineBudgetEditor({
  categoryId,
  initialAmount,
  currency,
  isEditing,
  onSave,
}: {
  categoryId: string;
  initialAmount: number;
  currency: CurrencyCode;
  isEditing: boolean;
  onSave: (categoryId: string, amount: number) => void;
}) {
  const [draft, setDraft] = useState(String(initialAmount || ""));
  const inputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing) {
      setDraft(String(initialAmount || ""));
      const input = inputRef.current?.querySelector("input");
      input?.focus();
      input?.select();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- initialAmount is captured at open time
  }, [isEditing]);

  function commit() {
    const num = parseFloat(draft) || 0;
    onSave(categoryId, num);
  }

  if (!isEditing) {
    if (initialAmount > 0) {
      return (
        <span className="text-sm font-semibold tabular-nums">
          {formatCurrency(initialAmount, currency)}
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-xs text-primary">
        <Plus className="size-3.5" />
        Asignar
      </span>
    );
  }

  return (
    <div ref={inputRef} className="w-28" onClick={(e) => e.stopPropagation()}>
      <CurrencyInput
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            onSave(categoryId, initialAmount);
          }
        }}
        className="h-7 text-sm px-2"
        placeholder="0"
      />
    </div>
  );
}

// ── Income Editor (settings popover) ─────────────────────────

function IncomeEditor({
  currentIncome,
  currency,
  onSave,
  isPending,
}: {
  currentIncome: number;
  currency: CurrencyCode;
  onSave: (amount: number) => void;
  isPending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(currentIncome));

  if (!editing) {
    return (
      <div>
        <p className="text-sm font-medium">Ingreso mensual</p>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {formatCurrency(currentIncome, currency)}
          </p>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Editar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Ingreso mensual</p>
      <CurrencyInput
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 text-sm"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={() => {
            const num = parseFloat(value);
            if (!isNaN(num) && num > 0) onSave(num);
            setEditing(false);
          }}
          disabled={isPending}
        >
          Guardar
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setValue(String(currentIncome));
            setEditing(false);
          }}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
