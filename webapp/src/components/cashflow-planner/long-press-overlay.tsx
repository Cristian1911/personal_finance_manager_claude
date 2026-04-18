"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { getEnvelopeColor } from "@/lib/constants/envelope-colors";
import { buildJarCapacityPreview } from "@/lib/utils/envelope-assignment";
import type { CurrencyCode } from "@/types/domain";
import type { IncomeEnvelope } from "@/types/cashflow-planner";

interface LongPressOverlayProps {
  expenseRemainder: number;
  currency: CurrencyCode;
  envelopes: IncomeEnvelope[];
  onPick: (envelopeId: string) => void;
  onSplit: () => void;
  onCancel: () => void;
}

export function LongPressOverlay({
  expenseRemainder,
  currency,
  envelopes,
  onPick,
  onSplit,
  onCancel,
}: LongPressOverlayProps) {
  return (
    <div
      role="dialog"
      aria-label="Asignar a envelope"
      className="absolute -inset-1 z-10 flex flex-col gap-2 rounded-xl bg-z-ink/80 p-3 backdrop-blur-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-center text-[11px] text-muted-foreground">
        Asignar {formatCurrency(expenseRemainder, currency)} a…
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {envelopes.map((env, idx) => {
          const color = getEnvelopeColor(idx);
          const preview = buildJarCapacityPreview({
            envelopeRemaining: env.remaining_amount,
            expenseRemainder,
          });
          const disabled = env.remaining_amount === 0;
          const hint = disabled
            ? "lleno"
            : preview.coversFull
              ? "cubre todo"
              : `cubre ${formatCurrency(preview.absorbs, currency)}`;
          return (
            <button
              key={env.entry.id}
              type="button"
              onClick={() => onPick(env.entry.id)}
              disabled={disabled}
              className={cn(
                "rounded-lg border bg-z-surface-2 p-2 text-center text-[10px] font-semibold transition-colors",
                disabled && "opacity-35",
              )}
              style={{
                borderColor: color.hex,
                color: color.hex,
              }}
            >
              {env.entry.label}
              <span
                className={cn(
                  "mt-0.5 block text-[9px] font-medium",
                  preview.coversFull || disabled ? "text-muted-foreground" : "text-z-expense",
                )}
              >
                {hint}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onSplit}
          className="text-[10px] font-semibold text-z-brass"
        >
          Dividir
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-[10px] text-muted-foreground"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
