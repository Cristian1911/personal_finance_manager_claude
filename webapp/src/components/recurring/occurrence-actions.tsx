"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Check, CircleSlash, Link2, Pencil, Pause, Play, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import type { OccurrenceItem } from "./use-recurring-month";
import type { RecurringTemplateWithRelations } from "@/types/domain";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SourceAccount {
  id: string;
  name: string;
}

type ActionPhase = "actions" | "confirm";
type ActionTab = "pagar" | "administrar";

export interface OccurrenceActionsProps {
  item: OccurrenceItem;
  template: RecurringTemplateWithRelations | null;
  onConfirm: (amount: number, date: string, sourceAccountId?: string) => void;
  onSkip: () => void;
  onLinkExisting?: () => void;
  onEdit?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onDelete?: () => void;
  isPending: boolean;
  sourceAccounts?: SourceAccount[];
}

/* ------------------------------------------------------------------ */
/*  Chip                                                               */
/* ------------------------------------------------------------------ */

const CHIP_CLASS =
  "flex items-center justify-center gap-1.5 rounded-lg border px-4 py-2.5 text-xs font-semibold transition-colors active:opacity-70 disabled:opacity-40";

const CHIP_VARIANT = {
  default: "border-white/8 bg-white/[0.04] text-foreground",
  danger: "border-z-debt/20 bg-z-debt/8 text-z-debt",
  income: "border-z-income/20 bg-z-income/8 text-z-income",
} as const;

function ActionChip({
  icon,
  label,
  variant = "default",
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  variant?: keyof typeof CHIP_VARIANT;
  onClick?: () => void;
  disabled?: boolean;
}) {

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(CHIP_CLASS, CHIP_VARIANT[variant])}
    >
      {icon}
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab bar                                                            */
/* ------------------------------------------------------------------ */

const TAB_BASE =
  "flex-1 rounded-lg py-1.5 text-center text-[11px] font-semibold transition-colors";

function TabBar({
  active,
  onChange,
}: {
  active: ActionTab;
  onChange: (tab: ActionTab) => void;
}) {
  return (
    <div className="flex rounded-xl border border-white/6 bg-white/[0.03] p-1">
      <button
        type="button"
        onClick={() => onChange("pagar")}
        className={cn(
          TAB_BASE,
          active === "pagar"
            ? "border border-z-brass/30 bg-z-brass/15 text-z-brass"
            : "text-muted-foreground",
        )}
      >
        Pagar
      </button>
      <button
        type="button"
        onClick={() => onChange("administrar")}
        className={cn(
          TAB_BASE,
          active === "administrar"
            ? "border border-white/6 bg-white/[0.06] text-foreground"
            : "text-muted-foreground",
        )}
      >
        Administrar
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function OccurrenceActions({
  item,
  template,
  onConfirm,
  onSkip,
  onLinkExisting,
  onEdit,
  onPause,
  onResume,
  onDelete,
  isPending,
  sourceAccounts,
}: OccurrenceActionsProps) {
  const [phase, setPhase] = useState<ActionPhase>("actions");
  const [activeTab, setActiveTab] = useState<ActionTab>("pagar");
  const isIncome = item.direction === "INFLOW" && !item.isDebtPayment;
  const isActive = template?.is_active !== false;

  // Form state
  const [amount, setAmount] = useState<string>(String(item.plannedAmount));
  const [paymentDate, setPaymentDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [sourceAccountId, setSourceAccountId] = useState<string>(
    item.transferSourceAccountId ?? "",
  );
  const needsSource = item.isDebtPayment;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const numericAmount = parseFloat(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return;
    onConfirm(
      numericAmount,
      paymentDate,
      needsSource ? sourceAccountId || undefined : undefined,
    );
  }

  /* ---- Phase: Actions (tabbed) ---- */
  if (phase === "actions") {
    return (
      <div className="space-y-3">
        <TabBar active={activeTab} onChange={setActiveTab} />

        {activeTab === "pagar" && (
          <div className="flex flex-col items-center gap-2.5">
            {/* Primary CTA */}
            <button
              type="button"
              onClick={() => {
                setPaymentDate(format(new Date(), "yyyy-MM-dd"));
                setPhase("confirm");
              }}
              disabled={isPending}
              className={cn(
                "rounded-xl px-10 py-2.5 text-xs font-semibold",
                BRASS_BUTTON_CLASS,
              )}
            >
              <Check className="mr-1.5 inline-block size-3.5" />
              {isIncome ? "Confirmar ingreso" : "Confirmar pago"}
            </button>

            {/* Secondary actions */}
            <div className="flex flex-wrap justify-center gap-2">
              <ActionChip
                icon={<CircleSlash className="size-3.5" />}
                label="Omitir"
                onClick={onSkip}
                disabled={isPending}
              />
              {onLinkExisting && (
                <ActionChip
                  icon={<Link2 className="size-3.5" />}
                  label="Vincular"
                  onClick={onLinkExisting}
                  disabled={isPending}
                />
              )}
            </div>
          </div>
        )}

        {activeTab === "administrar" && (
          <div className="space-y-2">
            {/* Edit + Pause/Resume */}
            <div className="flex flex-wrap justify-center gap-2">
              {onEdit && (
                <ActionChip
                  icon={<Pencil className="size-3" />}
                  label="Editar"
                  onClick={onEdit}
                  disabled={isPending}
                />
              )}
              {isActive && onPause && (
                <ActionChip
                  icon={<Pause className="size-3" />}
                  label="Pausar"
                  onClick={onPause}
                  disabled={isPending}
                />
              )}
              {!isActive && onResume && (
                <ActionChip
                  icon={<Play className="size-3" />}
                  label="Activar"
                  variant="income"
                  onClick={onResume}
                  disabled={isPending}
                />
              )}
            </div>

            {/* Danger zone */}
            {onDelete && (
              <div className="flex justify-center">
                <ActionChip
                  icon={<Trash2 className="size-3" />}
                  label="Eliminar"
                  variant="danger"
                  onClick={onDelete}
                  disabled={isPending}
                />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ---- Phase: Confirm form ---- */
  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs font-semibold">
        {isIncome ? "Confirmar ingreso" : "Confirmar pago"}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground">Monto</label>
          <CurrencyInput
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground">Fecha</label>
          <DatePicker
            value={paymentDate}
            onChange={(v) => setPaymentDate(v ?? format(new Date(), "yyyy-MM-dd"))}
            className="h-8 w-full"
          />
        </div>

        {needsSource && sourceAccounts && sourceAccounts.length > 0 && (
          <div className="col-span-2 space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">Cuenta origen</label>
            <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {sourceAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className={cn(
            "flex-1 rounded-lg py-2 text-xs font-semibold",
            BRASS_BUTTON_CLASS,
          )}
        >
          {isPending ? "Registrando..." : isIncome ? "Confirmar" : "Registrar pago"}
        </button>
        <button
          type="button"
          onClick={() => setPhase("actions")}
          disabled={isPending}
          className={cn("rounded-lg px-4 py-2 text-xs font-semibold", GHOST_BUTTON_CLASS)}
        >
          Atrás
        </button>
      </div>
    </form>
  );
}
