"use client";

import { describeInstallmentShare, type ComputeSplitResult, type InstallmentPlan } from "@zeta/shared";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode } from "@/types/domain";

function Row({ label, value, strong, hint }: { label: string; value: string; strong?: boolean; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className={cn("min-w-0", strong ? "font-medium" : "text-muted-foreground")}>
        {label}
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <span className={cn("shrink-0 tabular-nums", strong && "font-semibold text-z-brass")}>{value}</span>
    </div>
  );
}

/**
 * What sharing a purchase in cuotas means, before the user confirms: the whole
 * purchase is charged once (precio + interés estimado), each person's part,
 * and the cuota they would pay per month if they repay in the same N cuotas.
 */
export function InstallmentSharePreview({
  plan,
  split,
  currency,
  people,
}: {
  plan: InstallmentPlan;
  split: ComputeSplitResult;
  currency: CurrencyCode;
  people: { destinatario_id: string; name: string }[];
}) {
  const n = plan.installmentTotal;
  const eaPercent = (Math.pow(1 + plan.monthlyRate, 12) - 1) * 100;
  return (
    <div className={cn(PANEL_INSET_CLASS, "space-y-2 p-3")}>
      <Row label="Precio de la compra" value={formatCurrency(plan.principal, currency)} />
      {plan.interestKnown ? (
        <Row
          label="Interés estimado"
          hint={`${n} cuotas · tasa ${eaPercent.toFixed(1)}% EA`}
          value={formatCurrency(plan.totalInterest, currency)}
        />
      ) : (
        <p className="text-xs text-z-alert">Tasa no disponible en el extracto · se reparte sin interés estimado.</p>
      )}
      <Row label="Total a repartir" value={formatCurrency(plan.totalCost, currency)} strong />
      {split.ok ? (
        <div className="space-y-1.5 border-t border-white/6 pt-2">
          {split.shares.map((share, i) => {
            const person = people[i];
            const b = describeInstallmentShare(plan, share.amount);
            return (
              <Row
                key={share.destinatario_id ?? i}
                label={person?.name ?? "Persona"}
                hint={
                  plan.interestKnown
                    ? `${formatCurrency(b.sharePrincipal, currency)} + ${formatCurrency(b.shareInterest, currency)} de interés · si paga a cuotas: ${formatCurrency(b.suggestedInstallment, currency)} × ${n}`
                    : `si paga a cuotas: ${formatCurrency(b.suggestedInstallment, currency)} × ${n}`
                }
                value={formatCurrency(share.amount, currency)}
              />
            );
          })}
          <Row
            label="Tu parte"
            hint={`${formatCurrency(describeInstallmentShare(plan, split.userShare).suggestedInstallment, currency)} por cuota`}
            value={formatCurrency(split.userShare, currency)}
          />
        </div>
      ) : (
        <p className="text-xs text-z-alert">Revisa los porcentajes: deben sumar 100.</p>
      )}
      <p className="text-xs text-muted-foreground">
        Se registra la compra completa una sola vez; las cuotas siguientes se vinculan a este reparto.
      </p>
    </div>
  );
}
