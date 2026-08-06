"use client";

import { useState } from "react";
import { Plus, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DestinatarioZonePicker } from "@/components/destinatarios/destinatario-zone-picker";
import { cn } from "@/lib/utils";
import {
  BRASS_GHOST_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  ICON_DESTRUCTIVE_TRIGGER_CLASS,
  PANEL_INSET_CLASS,
} from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";
import type { computeSplit, SplitMethod } from "@zeta/shared";
import type { CurrencyCode } from "@/types/domain";

/**
 * One row of a split. `destinatarioId` set = an existing contact was picked;
 * otherwise `name` holds a typed ad-hoc name that the server materializes into a
 * hidden destinatario. Exactly one of the two is ever meaningful — the UI
 * enforces it by swapping the row between the two states.
 */
export interface SplitParticipantRow {
  key: number;
  destinatarioId: string | null;
  name: string;
  value: string;
}

export function newParticipantRow(key: number): SplitParticipantRow {
  return { key, destinatarioId: null, name: "", value: "" };
}

/** Rows the user has actually filled in — a picked contact or a typed name. */
export function validSplitParticipants(
  rows: SplitParticipantRow[],
): SplitParticipantRow[] {
  return rows.filter((p) => p.destinatarioId !== null || p.name.trim() !== "");
}

/** Server payload: a contact id XOR a bare name, per `splitParticipantSchema`. */
export function toParticipantPayload(rows: SplitParticipantRow[]) {
  return validSplitParticipants(rows).map((p) => ({
    ...(p.destinatarioId ? { destinatario_id: p.destinatarioId } : { name: p.name.trim() }),
    value: p.value === "" ? undefined : Number.parseFloat(p.value),
  }));
}

/** Input for `computeSplit` — ids are irrelevant to the math, only the count is. */
export function toSplitInput(rows: SplitParticipantRow[]) {
  return validSplitParticipants(rows).map((p) => ({
    destinatario_id: p.destinatarioId,
    value: p.value === "" ? undefined : Number.parseFloat(p.value),
  }));
}

const METHOD_LABELS: { value: SplitMethod; label: string }[] = [
  { value: "equal", label: "Iguales" },
  { value: "amount", label: "Montos" },
  { value: "percent", label: "%" },
];

interface SplitParticipantsEditorProps {
  participants: SplitParticipantRow[];
  onChange: (next: SplitParticipantRow[]) => void;
  method: SplitMethod;
  onMethodChange: (method: SplitMethod) => void;
  /** Keep at least this many rows on screen (the remove button hides below it). */
  minRows?: number;
}

export function SplitParticipantsEditor({
  participants,
  onChange,
  method,
  onMethodChange,
  minRows = 1,
}: SplitParticipantsEditorProps) {
  const nextKey = participants.reduce((max, p) => Math.max(max, p.key), 0) + 1;

  function update(key: number, patch: Partial<SplitParticipantRow>) {
    onChange(participants.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  return (
    <>
      <div className="space-y-2">
        <Label>Tipo de reparto</Label>
        <div className="grid grid-cols-3 gap-2">
          {METHOD_LABELS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => onMethodChange(m.value)}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                method === m.value ? BRASS_GHOST_BUTTON_CLASS : GHOST_BUTTON_CLASS,
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label>Personas</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Escribe un nombre o elige un contacto. Los nombres sueltos no se guardan en
            tu lista de personas.
          </p>
        </div>
        {participants.map((p) => (
          <ParticipantRowFields
            key={p.key}
            row={p}
            method={method}
            canRemove={participants.length > minRows}
            onChange={(patch) => update(p.key, patch)}
            onRemove={() => onChange(participants.filter((x) => x.key !== p.key))}
          />
        ))}
        <Button
          type="button"
          variant="ghost"
          onClick={() => onChange([...participants, newParticipantRow(nextKey)])}
          className={cn(GHOST_BUTTON_CLASS, "w-full")}
        >
          <Plus className="mr-1.5 size-4" />
          Agregar persona
        </Button>
      </div>
    </>
  );
}

function ParticipantRowFields({
  row,
  method,
  canRemove,
  onChange,
  onRemove,
}: {
  row: SplitParticipantRow;
  method: SplitMethod;
  canRemove: boolean;
  onChange: (patch: Partial<SplitParticipantRow>) => void;
  onRemove: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const isContact = row.destinatarioId !== null;

  return (
    <div className="flex items-start gap-2">
      <div className="flex flex-1 items-center gap-2">
        {isContact ? (
          <div className="flex h-9 flex-1 items-center gap-2 rounded-md border border-z-brass/30 bg-z-brass/10 px-3 text-sm">
            <UserRound className="size-3.5 shrink-0 text-z-brass" />
            <span className="truncate">{row.name}</span>
            <button
              type="button"
              onClick={() => onChange({ destinatarioId: null, name: "" })}
              aria-label="Quitar contacto"
              className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <>
            <Input
              value={row.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="Nombre de la persona"
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Elegir un contacto existente"
              title="Elegir un contacto existente"
              onClick={() => setPickerOpen(true)}
              className={cn(GHOST_BUTTON_CLASS, "size-9 shrink-0")}
            >
              <UserRound className="size-4" />
            </Button>
          </>
        )}
        {/* Always mounted but trigger-less: the icon button above drives it. */}
        <DestinatarioZonePicker
          value={row.destinatarioId}
          onValueChange={(id, name) => onChange({ destinatarioId: id, name: name ?? "" })}
          selectedName={isContact ? row.name : null}
          kindFilter={["person"]}
          createKind="person"
          variant="dialog"
          hideTrigger
          controlledOpen={pickerOpen}
          onControlledOpenChange={setPickerOpen}
        />
      </div>

      {method === "amount" && (
        <CurrencyInput
          inputMode="numeric"
          value={row.value}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder="$"
          className="w-28 shrink-0 text-right tabular-nums"
        />
      )}
      {method === "percent" && (
        <div className="relative w-20 shrink-0">
          <Input
            inputMode="decimal"
            value={row.value}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder="0"
            className="pr-6 text-right tabular-nums"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            %
          </span>
        </div>
      )}
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Quitar persona"
          className={cn(ICON_DESTRUCTIVE_TRIGGER_CLASS, "mt-1 shrink-0 p-1.5")}
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

const ERROR_TEXT: Record<string, string> = {
  no_participants: "Agrega al menos una persona.",
  invalid_total: "Ingresa el monto total del pago.",
  negative_value: "Los valores no pueden ser negativos.",
  amount_sum_exceeds_total: "Las partes superan el total del pago.",
  amount_sum_mismatch: "Las partes deben sumar exactamente el total.",
  percent_out_of_range: "Los porcentajes superan el 100%.",
  percent_sum_mismatch: "Los porcentajes deben sumar 100%.",
};

export function SplitPreview({
  preview,
  participants,
  currency,
  total,
  /** Label for the payer's own share; null hides the row (debt splits have none). */
  userShareLabel = "Tu parte",
}: {
  preview: ReturnType<typeof computeSplit> | null;
  participants: SplitParticipantRow[];
  currency: CurrencyCode;
  total: number;
  userShareLabel?: string | null;
}) {
  if (!preview) return null;
  if (!preview.ok) {
    return (
      <p className="rounded-xl border border-z-debt/30 bg-z-debt/10 px-3 py-2 text-sm text-z-debt">
        {ERROR_TEXT[preview.reason] ?? "Revisa los montos del reparto."}
      </p>
    );
  }
  return (
    <div className={cn("space-y-1.5 p-4", PANEL_INSET_CLASS)}>
      {userShareLabel && (
        <PreviewRow
          label={userShareLabel}
          value={formatCurrency(preview.userShare, currency)}
          highlight
        />
      )}
      {preview.shares.map((s, i) => (
        <PreviewRow
          key={participants[i]?.key ?? i}
          label={participants[i]?.name.trim() || "Persona"}
          value={formatCurrency(s.amount, currency)}
        />
      ))}
      <div className="mt-2 flex items-center justify-between border-t border-white/6 pt-2 text-xs text-muted-foreground">
        <span>Total</span>
        <span className="tabular-nums">{formatCurrency(total, currency)}</span>
      </div>
    </div>
  );
}

function PreviewRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={cn("truncate", highlight ? "text-z-brass" : "text-foreground")}>
        {label}
      </span>
      <span className={cn("tabular-nums", highlight ? "font-semibold text-z-brass" : "")}>
        {value}
      </span>
    </div>
  );
}
