"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { computeSplit, estimateInstallmentPlan, getCurrencyDecimals, isInstallmentPurchase } from "@zeta/shared";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DestinatarioZonePicker } from "@/components/destinatarios/destinatario-zone-picker";
import { useDestinatarios } from "@/components/providers/app-data-provider";
import { InstallmentSharePreview } from "./installment-share-preview";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import {
  BRASS_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  ICON_DESTRUCTIVE_TRIGGER_CLASS,
  MOBILE_SHEET_SAFE_AREA_CLASS,
  PANEL_INSET_CLASS,
  chipToggleClass,
} from "@/lib/constants/styles";
import type { CurrencyCode, ModoWithParticipants } from "@/types/domain";
import type { RowShare, RowShareParticipant } from "@/lib/import/review-enrichment";

export type SharePreviewRow = {
  description: string;
  amount: number;
  currency: string;
  installment_current: number | null;
  installment_total: number | null;
  original_amount: number | null;
  ea_rate_percent: number | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: RowShare | null;
  onChange: (share: RowShare | null) => void;
  /** The trip the row is filed under, for the "Personas del viaje" preset. */
  modo?: ModoWithParticipants | null;
  /** The row being shared; omitted when applying to several rows at once. */
  row?: SharePreviewRow | null;
  bulkCount?: number;
};

/**
 * "Compartido con…" for an import row: people, method, whether you take a
 * part, and a live preview. A purchase in cuotas previews the whole-purchase
 * rule (precio + interés estimado, cuota sugerida por persona).
 */
export function ImportSharePicker({ open, onOpenChange, value, onChange, modo, row, bulkCount }: Props) {
  const destinatarios = useDestinatarios();
  const nameOf = (id: string) => destinatarios.find((d) => d.id === id)?.name ?? "Persona";

  const modoPreset = useMemo<RowShare | null>(() => {
    if (!modo?.is_shared || modo.participants.length === 0) return null;
    return {
      method: (modo.split_method as "equal" | "percent") ?? "equal",
      userIncluded: modo.user_included ?? true,
      participants: modo.participants.map((p) => ({
        destinatario_id: p.destinatario_id,
        name: nameOf(p.destinatario_id),
        value: p.share_value ?? undefined,
      })),
      source: "modo",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, destinatarios]);

  const [draft, setDraft] = useState<RowShare>(
    () => value ?? modoPreset ?? { method: "equal", userIncluded: true, participants: [], source: "custom" },
  );

  function patch(p: Partial<RowShare>) {
    setDraft((d) => ({ ...d, ...p, source: "custom" }));
  }
  function addPerson(id: string | null, name: string | null) {
    if (!id) return;
    if (draft.participants.some((p) => p.destinatario_id === id)) return;
    patch({ participants: [...draft.participants, { destinatario_id: id, name: name ?? nameOf(id) }] });
  }
  function removePerson(id: string) {
    patch({ participants: draft.participants.filter((p) => p.destinatario_id !== id) });
  }
  function setValue(id: string, raw: string) {
    const v = raw === "" ? undefined : Number(raw.replace(",", "."));
    patch({
      participants: draft.participants.map((p) =>
        p.destinatario_id === id ? { ...p, value: Number.isFinite(v as number) ? v : undefined } : p,
      ),
    });
  }

  const currency = (row?.currency ?? "COP") as CurrencyCode;
  const decimals = getCurrencyDecimals(currency);
  const isInstallment = !!row && isInstallmentPurchase(row);
  const plan = useMemo(() => {
    if (!row || !isInstallment) return null;
    const n = row.installment_total ?? 1;
    return estimateInstallmentPlan({
      principal: row.original_amount ?? row.amount * n,
      installmentTotal: n,
      eaRatePercent: row.ea_rate_percent,
      decimals,
    });
  }, [row, isInstallment, decimals]);

  const split = useMemo(() => {
    if (!row || draft.participants.length === 0) return null;
    return computeSplit({
      total: plan ? plan.totalCost : row.amount,
      method: draft.method,
      participants: draft.participants.map((p) => ({ destinatario_id: p.destinatario_id, value: p.value })),
      userIncluded: draft.userIncluded,
      decimals,
    });
  }, [row, draft, plan, decimals]);

  const canSave = draft.participants.length > 0 && (!split || split.ok);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={cn("max-h-[90dvh] overflow-y-auto", MOBILE_SHEET_SAFE_AREA_CLASS)}>
        <div className="mx-auto w-full max-w-md px-7">
          <SheetHeader className="px-0 pt-1">
            <SheetTitle>Compartir con…</SheetTitle>
            <SheetDescription>
              {row
                ? `${row.description} · ${formatCurrency(row.amount, currency)}${isInstallment && row.installment_total ? ` · cuota ${row.installment_current}/${row.installment_total}` : ""}`
                : `Se aplicará a ${bulkCount ?? 0} movimientos marcados.`}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 pb-4 pt-2">
            {modoPreset && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={draft.source === "modo"}
                  className={chipToggleClass(draft.source === "modo")}
                  onClick={() => setDraft(modoPreset)}
                >
                  {modo?.emoji ? `${modo.emoji} ` : ""}Personas del viaje
                </button>
                <button
                  type="button"
                  aria-pressed={draft.source === "custom"}
                  className={chipToggleClass(draft.source === "custom")}
                  onClick={() => patch({})}
                >
                  Elegir personas
                </button>
              </div>
            )}

            <div className="space-y-2">
              <Label>Personas</Label>
              {draft.participants.length === 0 && (
                <p className="text-sm text-muted-foreground">¿Con quién repartes este gasto?</p>
              )}
              {draft.participants.map((p: RowShareParticipant) => (
                <div key={p.destinatario_id} className={cn(PANEL_INSET_CLASS, "flex items-center gap-2 px-3 py-2")}>
                  <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                  {draft.method === "percent" && (
                    <div className="relative w-20 shrink-0">
                      <Input
                        inputMode="decimal"
                        value={p.value ?? ""}
                        onChange={(e) => setValue(p.destinatario_id, e.target.value)}
                        placeholder="0"
                        className="h-8 pr-6 text-right tabular-nums"
                        aria-label={`Porcentaje de ${p.name}`}
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        %
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removePerson(p.destinatario_id)}
                    aria-label={`Quitar a ${p.name}`}
                    className={cn(ICON_DESTRUCTIVE_TRIGGER_CLASS, "shrink-0 p-1")}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
              <DestinatarioZonePicker
                value={null}
                onValueChange={addPerson}
                placeholder="Agregar persona"
                triggerClassName="w-full"
                kindFilter={["person"]}
                createKind="person"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Reparto</Label>
              <div className="flex gap-2">
                {(["equal", "percent"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => patch({ method: m })}
                    aria-pressed={draft.method === m}
                    className={chipToggleClass(draft.method === m)}
                  >
                    {m === "equal" ? "Partes iguales" : "Porcentaje"}
                  </button>
                ))}
              </div>
              {draft.method === "percent" && (
                <p className="text-xs text-muted-foreground">
                  Los porcentajes son de las otras personas; si te incluyes, tú tomas el resto.
                </p>
              )}
            </div>

            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Yo también participo</span>
              <Switch checked={draft.userIncluded} onCheckedChange={(v) => patch({ userIncluded: v })} aria-label="Yo también participo" />
            </label>

            {row && split && plan && (
              <InstallmentSharePreview plan={plan} split={split} currency={currency} people={draft.participants} />
            )}
            {row && split && !plan && (
              <div className={cn(PANEL_INSET_CLASS, "space-y-1.5 p-3 text-sm")}>
                {split.ok ? (
                  <>
                    {split.shares.map((s, i) => (
                      <div key={s.destinatario_id ?? i} className="flex justify-between gap-3">
                        <span className="min-w-0 truncate text-muted-foreground">{draft.participants[i]?.name ?? "Persona"}</span>
                        <span className="tabular-nums">{formatCurrency(s.amount, currency)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between gap-3 border-t border-white/6 pt-1.5">
                      <span className="font-medium">Tu parte</span>
                      <span className="font-semibold tabular-nums text-z-brass">{formatCurrency(split.userShare, currency)}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-z-alert">Revisa los porcentajes: deben sumar 100.</p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              {value && (
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(GHOST_BUTTON_CLASS, "w-full sm:w-auto")}
                  onClick={() => {
                    onChange(null);
                    onOpenChange(false);
                  }}
                >
                  Quitar reparto
                </Button>
              )}
              <Button
                type="button"
                className={cn(BRASS_BUTTON_CLASS, "w-full sm:w-auto")}
                disabled={!canSave}
                onClick={() => {
                  onChange(draft);
                  onOpenChange(false);
                }}
              >
                <Plus className="size-4" />
                Listo
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
