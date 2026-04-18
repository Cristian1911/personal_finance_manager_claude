"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { EnvelopeJar } from "./envelope-jar";
import { ExpenseCardDraggable } from "./expense-card-draggable";
import { DropTooltip } from "./drop-tooltip";
import { AssignmentPopover } from "./assignment-popover";
import { LongPressOverlay } from "./long-press-overlay";
import { EntryFormDialog } from "./entry-form-dialog";
import { EditEntryDialog } from "./edit-entry-dialog";
import { PayExpenseDialog } from "./pay-expense-dialog";
import { AutoAssignButton } from "./auto-assign-button";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { buildEnvelopeMaps } from "@/lib/utils/cashflow-planner";
import {
  clampAssignmentAmount,
  buildJarCapacityPreview,
  findExistingAssignment,
} from "@/lib/utils/envelope-assignment";
import {
  createAssignment,
  updateAssignment,
  deletePlanningEntry,
  toggleEntryStatus,
} from "@/actions/cashflow-planner";
import { formatCurrency } from "@/lib/utils/currency";
import { Wallet, Receipt } from "lucide-react";
import { toast } from "sonner";
import type { Category, PlanningEntryStatus } from "@/types/domain";
import type {
  IncomeEnvelope,
  PeriodPlanData,
  PlanningEntryWithRelations,
} from "@/types/cashflow-planner";
import type { PlanAccount } from "@/components/mobile/v2/plan/mobile-periodo-view";

interface DragEnvelopeBoardProps {
  data: PeriodPlanData;
  accounts?: PlanAccount[];
  categories?: Pick<Category, "id" | "name" | "name_es" | "icon" | "color">[];
  /** Stable DnD scope id — required when multiple instances mount in the same tree
   *  (e.g. mobile + desktop branches both CSS-hidden). Prevents `useId` drift during hydration. */
  dndId?: string;
}

interface DragState {
  expenseId: string;
  remainder: number;
  overJarId: string | null;
  altHeld: boolean;
}

/** Drive the tooltip position via CSS transform on a ref — pointermove must never setState,
 *  else every move re-renders every jar + card at 60–120 Hz. */
function usePointerTooltipTracker(
  active: boolean,
  tooltipRef: React.RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    if (!active) return;
    const handle = (e: PointerEvent) => {
      const el = tooltipRef.current;
      if (el) {
        el.style.transform = `translate3d(${e.clientX + 18}px, ${e.clientY + 18}px, 0)`;
      }
    };
    document.addEventListener("pointermove", handle, { passive: true });
    return () => document.removeEventListener("pointermove", handle);
  }, [active, tooltipRef]);
}

export function DragEnvelopeBoard({
  data,
  accounts = [],
  categories = [],
  dndId = "drag-envelope-board",
}: DragEnvelopeBoardProps) {
  const { income_envelopes, expense_entries, currency, period } = data;
  const [isPending, startTransition] = useTransition();
  const [drag, setDrag] = useState<DragState | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [editTarget, setEditTarget] = useState<PlanningEntryWithRelations | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<PlanningEntryWithRelations | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const periodMonth = period.start_date.slice(0, 7);
  const [splitTarget, setSplitTarget] = useState<{
    expense: PlanningEntryWithRelations;
    envelope: IncomeEnvelope;
    colorIndex: number;
    max: number;
    initial: number;
    existing?: { id: string };
  } | null>(null);
  const [longPressTarget, setLongPressTarget] =
    useState<PlanningEntryWithRelations | null>(null);

  const { assignedPerExpense, expenseAssignmentChips } = useMemo(
    () => buildEnvelopeMaps(income_envelopes),
    [income_envelopes],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  usePointerTooltipTracker(!!drag, tooltipRef);

  function remainderOf(expenseId: string, convertedAmount: number) {
    return Math.max(0, convertedAmount - (assignedPerExpense.get(expenseId) ?? 0));
  }

  function envelopeByJarId(
    jarId: string,
  ): { envelope: IncomeEnvelope; colorIndex: number } | null {
    const idx = income_envelopes.findIndex((e) => `jar-${e.entry.id}` === jarId);
    if (idx < 0) return null;
    return { envelope: income_envelopes[idx], colorIndex: idx };
  }

  function expenseById(id: string): PlanningEntryWithRelations | undefined {
    return expense_entries.find((e) => e.id === id);
  }

  function handleDragStart(e: DragStartEvent) {
    const payload = e.active.data.current as {
      kind: "expense";
      entry: PlanningEntryWithRelations;
      remainder: number;
    };
    setDrag({
      expenseId: payload.entry.id,
      remainder: payload.remainder,
      overJarId: null,
      altHeld: false,
    });
  }

  function handleDragMove(e: DragOverEvent & { activatorEvent?: Event }) {
    setDrag((prev) => {
      if (!prev) return null;
      const evt = (e.activatorEvent ?? null) as MouseEvent | null;
      const altHeld = evt ? evt.altKey : prev.altHeld;
      return { ...prev, overJarId: e.over?.id ? String(e.over.id) : null, altHeld };
    });
  }

  function handleDragEnd(e: DragEndEvent) {
    if (!drag) {
      setDrag(null);
      return;
    }
    // Guard: rapid drops while a prior mutation is in-flight see stale remaining_amount
    // and can request more capacity than the jar will have after the server-side commit.
    if (isPending) {
      setDrag(null);
      return;
    }
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) {
      setDrag(null);
      return;
    }
    const hit = envelopeByJarId(overId);
    const expense = expenseById(drag.expenseId);
    if (!hit || !expense) {
      setDrag(null);
      return;
    }

    const preview = buildJarCapacityPreview({
      envelopeRemaining: hit.envelope.remaining_amount,
      expenseRemainder: drag.remainder,
    });
    if (preview.absorbs <= 0) {
      setDrag(null);
      return;
    }

    const existing = findExistingAssignment(hit.envelope, expense.id);
    const nativeEvt = e.activatorEvent as MouseEvent | undefined;
    const altHeld =
      !!(nativeEvt && "altKey" in nativeEvt && nativeEvt.altKey) || drag.altHeld;

    if (altHeld) {
      setSplitTarget({
        expense,
        envelope: hit.envelope,
        colorIndex: hit.colorIndex,
        max: preview.absorbs + (existing ? Number(existing.assigned_amount) : 0),
        initial: preview.absorbs,
        existing: existing ? { id: existing.id } : undefined,
      });
      setDrag(null);
      return;
    }

    const newAmount = clampAssignmentAmount({
      envelopeRemaining: hit.envelope.remaining_amount,
      expenseRemaining: drag.remainder,
      requested: drag.remainder,
    });

    setDrag(null);
    startTransition(async () => {
      const result = existing
        ? await updateAssignment(existing.id, Number(existing.assigned_amount) + newAmount)
        : await createAssignment(hit.envelope.entry.id, expense.id, newAmount);
      if (!result.success) toast.error(result.error);
    });
  }

  function handleLongPress(entry: PlanningEntryWithRelations) {
    setLongPressTarget(entry);
  }

  function handleChipPick(envelopeId: string) {
    if (!longPressTarget || isPending) return;
    const envelope = income_envelopes.find((e) => e.entry.id === envelopeId);
    if (!envelope) return;
    const rem = remainderOf(longPressTarget.id, longPressTarget.converted_amount);
    const absorbs = clampAssignmentAmount({
      envelopeRemaining: envelope.remaining_amount,
      expenseRemaining: rem,
      requested: rem,
    });
    if (absorbs <= 0) {
      setLongPressTarget(null);
      return;
    }
    const existing = findExistingAssignment(envelope, longPressTarget.id);
    const expenseId = longPressTarget.id;
    setLongPressTarget(null);
    startTransition(async () => {
      const result = existing
        ? await updateAssignment(existing.id, Number(existing.assigned_amount) + absorbs)
        : await createAssignment(envelope.entry.id, expenseId, absorbs);
      if (!result.success) toast.error(result.error);
    });
  }

  function handleChipSplit() {
    if (!longPressTarget) return;
    const env = income_envelopes.find((e) => e.remaining_amount > 0);
    if (!env) return;
    const colorIndex = income_envelopes.indexOf(env);
    const rem = remainderOf(longPressTarget.id, longPressTarget.converted_amount);
    const preview = buildJarCapacityPreview({
      envelopeRemaining: env.remaining_amount,
      expenseRemainder: rem,
    });
    const existing = findExistingAssignment(env, longPressTarget.id);
    setSplitTarget({
      expense: longPressTarget,
      envelope: env,
      colorIndex,
      max: preview.absorbs + (existing ? Number(existing.assigned_amount) : 0),
      initial: preview.absorbs,
      existing: existing ? { id: existing.id } : undefined,
    });
    setLongPressTarget(null);
  }

  function handleToggleIncomeStatus(
    entry: PlanningEntryWithRelations,
    next: PlanningEntryStatus,
  ) {
    startTransition(async () => {
      const result = await toggleEntryStatus(entry.id, next);
      if (!result.success) toast.error(result.error);
    });
  }

  function handleDeleteEntry(id: string) {
    startTransition(async () => {
      const result = await deletePlanningEntry(id);
      if (result.success) toast.success("Eliminado");
      else toast.error(result.error);
    });
  }

  const currentDragPreview = useMemo(() => {
    if (!drag?.overJarId) return null;
    const hit = envelopeByJarId(drag.overJarId);
    if (!hit) return null;
    return buildJarCapacityPreview({
      envelopeRemaining: hit.envelope.remaining_amount,
      expenseRemainder: drag.remainder,
    });
  }, [drag, income_envelopes]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentHoveredJar = drag?.overJarId ? envelopeByJarId(drag.overJarId) : null;

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDrag(null)}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-z-income" />
            <SectionEyebrow>Sobres</SectionEyebrow>
          </div>
          <EntryFormDialog
            periodId={period.id}
            currency={currency}
            defaultType="INCOME"
            accounts={accounts}
            categories={categories}
          />
        </div>

        {income_envelopes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No hay ingresos en este periodo
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {income_envelopes.map((env, i) => (
              <JarSlot
                key={env.entry.id}
                envelope={env}
                colorIndex={i}
                currency={currency}
                dragOverId={drag?.overJarId ?? null}
                preview={
                  drag?.overJarId === `jar-${env.entry.id}` && currentDragPreview
                    ? {
                        absorbs: currentDragPreview.absorbs,
                        jarWouldFill: currentDragPreview.jarWouldFill,
                      }
                    : null
                }
                onToggleStatus={handleToggleIncomeStatus}
                onEdit={(entry) => {
                  setEditTarget(entry);
                  setEditOpen(true);
                }}
                onDelete={handleDeleteEntry}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-z-expense" />
            <SectionEyebrow>Gastos</SectionEyebrow>
          </div>
          <div className="flex items-center gap-2">
            {income_envelopes.length > 0 && <AutoAssignButton periodId={period.id} />}
            <EntryFormDialog
              periodId={period.id}
              currency={currency}
              defaultType="EXPENSE"
              accounts={accounts}
              categories={categories}
            />
          </div>
        </div>

        {expense_entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
            <p className="text-sm text-muted-foreground">No hay gastos en este periodo</p>
          </div>
        ) : (
          <div className="space-y-2">
            {expense_entries.map((entry) => (
              <div key={entry.id} className="relative">
                <ExpenseCardDraggable
                  entry={entry}
                  currency={currency}
                  assignmentChips={expenseAssignmentChips.get(entry.id) ?? []}
                  assignedAmount={assignedPerExpense.get(entry.id) ?? 0}
                  onEdit={(e) => {
                    setEditTarget(e);
                    setEditOpen(true);
                  }}
                  onDelete={handleDeleteEntry}
                  onPay={(e) => {
                    setPayTarget(e);
                    setPayOpen(true);
                  }}
                  onRestoClick={handleLongPress}
                  onLongPress={handleLongPress}
                />
                {longPressTarget?.id === entry.id && (
                  <LongPressOverlay
                    expenseRemainder={remainderOf(entry.id, entry.converted_amount)}
                    currency={currency}
                    envelopes={income_envelopes}
                    onPick={handleChipPick}
                    onSplit={handleChipSplit}
                    onCancel={() => setLongPressTarget(null)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {drag && currentDragPreview && currentHoveredJar && (
        <DropTooltip
          tooltipRef={tooltipRef}
          envelopeLabel={currentHoveredJar.envelope.entry.label}
          colorIndex={currentHoveredJar.colorIndex}
          currency={currency}
          preview={currentDragPreview}
          existingAssigned={currentHoveredJar.envelope.assigned_amount}
          envelopeTotal={currentHoveredJar.envelope.total_amount}
        />
      )}

      <DragOverlay dropAnimation={null}>
        {drag ? <GhostCard expenseId={drag.expenseId} expenses={expense_entries} /> : null}
      </DragOverlay>

      <EditEntryDialog
        entry={editTarget}
        open={editOpen}
        onOpenChange={setEditOpen}
        currency={currency}
        accounts={accounts}
        categories={categories}
      />

      <PayExpenseDialog
        entry={payTarget}
        open={payOpen}
        onOpenChange={setPayOpen}
        currency={currency}
        accounts={accounts}
        periodMonth={periodMonth}
      />

      {splitTarget && (
        <AssignmentPopover
          open
          onOpenChange={(v) => !v && setSplitTarget(null)}
          anchor={<span className="sr-only">split anchor</span>}
          envelopeLabel={splitTarget.envelope.entry.label}
          envelopeColorIndex={splitTarget.colorIndex}
          maxAmount={splitTarget.max}
          initialAmount={splitTarget.initial}
          currency={currency}
          mode={
            splitTarget.existing
              ? { kind: "update", assignmentId: splitTarget.existing.id }
              : {
                  kind: "create",
                  incomeEntryId: splitTarget.envelope.entry.id,
                  expenseEntryId: splitTarget.expense.id,
                }
          }
          allowRemove={!!splitTarget.existing}
          assignmentIdToRemove={splitTarget.existing?.id}
        />
      )}
    </DndContext>
  );
}

function JarSlot(props: {
  envelope: IncomeEnvelope;
  colorIndex: number;
  currency: import("@/types/domain").CurrencyCode;
  dragOverId: string | null;
  preview: { absorbs: number; jarWouldFill: boolean } | null;
  onToggleStatus: (e: PlanningEntryWithRelations, n: PlanningEntryStatus) => void;
  onEdit: (e: PlanningEntryWithRelations) => void;
  onDelete: (id: string) => void;
}) {
  const { setNodeRef } = useDroppable({
    id: `jar-${props.envelope.entry.id}`,
    data: { kind: "jar", envelopeId: props.envelope.entry.id },
    disabled: props.envelope.remaining_amount === 0,
  });
  return (
    <EnvelopeJar
      envelope={props.envelope}
      colorIndex={props.colorIndex}
      currency={props.currency}
      isDropTarget={props.dragOverId === `jar-${props.envelope.entry.id}`}
      preview={props.preview}
      dropRef={setNodeRef}
      onToggleStatus={props.onToggleStatus}
      onEdit={props.onEdit}
      onDelete={props.onDelete}
    />
  );
}

function GhostCard({
  expenseId,
  expenses,
}: {
  expenseId: string;
  expenses: PlanningEntryWithRelations[];
}) {
  const expense = expenses.find((e) => e.id === expenseId);
  if (!expense) return null;
  return (
    <div className="pointer-events-none rounded-lg border border-z-brass bg-z-surface-3 px-4 py-3 shadow-2xl">
      <p className="text-sm font-medium">{expense.label}</p>
      <p className="text-xs text-z-brass-hot tabular-nums">
        {formatCurrency(expense.converted_amount, expense.currency_code)}
      </p>
    </div>
  );
}
