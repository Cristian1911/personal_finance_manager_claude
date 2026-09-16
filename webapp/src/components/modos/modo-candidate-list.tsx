"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TagChip } from "@/components/tags/tag-chip";
import { Expand } from "@/components/mobile/v2/expand";
import { DetailCell } from "@/components/mobile/v2/deudas/detail-cell";
import { getTransactionLocation } from "@/actions/transactions";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate, formatDateTime } from "@/lib/utils/date";
import { captureMethodLabel } from "@/lib/constants/capture-methods";
import { cn } from "@/lib/utils";
import {
  BRASS_GHOST_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  PANEL_INSET_CLASS,
  ROW_EXPAND_TRIGGER_CLASS,
} from "@/lib/constants/styles";
import type { ModoCandidateRow } from "@/actions/modos";
import type { CurrencyCode, TransactionLocation } from "@/types/domain";

export function describeCandidate(row: ModoCandidateRow): string {
  return (
    row.merchant_name?.trim() ||
    row.clean_description?.trim() ||
    row.raw_description?.trim() ||
    row.category?.name_es ||
    row.category?.name ||
    "Movimiento"
  );
}

/** Only reasons that carry signal get a chip; "importado" is the default and says nothing. */
function reasonLabel(row: ModoCandidateRow): string | null {
  if (row.candidate.foreignCurrency) return "Moneda extranjera";
  if (row.flow_class_effective === "CASH_WITHDRAWAL") return "Retiro";
  if (row.candidate.reason === "manual_capture") return "A mano";
  return null;
}

/** Nested guide line for the expanded body (same as the tendencias drilldowns). */
const NEST_GUIDE_CLASS = "ml-2 border-l border-white/6 pl-3";

interface ModoCandidateListProps {
  rows: ModoCandidateRow[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll?: (next: boolean) => void;
  /** Rows the user explicitly said were NOT the trip's (stay visible, dimmed). */
  rejected?: Set<string>;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  /** Cap rendered rows (wizard); the tray shows everything. */
  limit?: number;
  className?: string;
}

/**
 * "¿Fueron del viaje?" — one row per candidate. The checkbox decides; the rest
 * of the row expands to the detail needed to decide (original description,
 * time, account, category, destinatario, origin, notes, tags, location) plus
 * an explicit "Sí / No" pair. Shared by the wizard's last step and the tray.
 */
export function ModoCandidateList({
  rows,
  selected,
  onToggle,
  onToggleAll,
  rejected,
  onAccept,
  onReject,
  limit,
  className,
}: ModoCandidateListProps) {
  const visible = limit ? rows.slice(0, limit) : rows;
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  return (
    <div className={cn(PANEL_INSET_CLASS, "overflow-hidden", className)}>
      {onToggleAll && rows.length > 1 && (
        <label className="flex items-center gap-3 border-b border-white/6 px-3 py-2 text-xs text-muted-foreground">
          <Checkbox
            checked={allSelected ? true : selected.size > 0 ? "indeterminate" : false}
            onCheckedChange={(v) => onToggleAll(v === true)}
            aria-label="Seleccionar todos"
          />
          {allSelected ? "Quitar selección" : "Seleccionar todos"} · {rows.length}
        </label>
      )}
      <ul className="divide-y divide-white/6">
        {visible.map((row) => (
          <CandidateItem
            key={row.id}
            row={row}
            checked={selected.has(row.id)}
            isRejected={rejected?.has(row.id) ?? false}
            onToggle={() => onToggle(row.id)}
            onAccept={onAccept ? () => onAccept(row.id) : undefined}
            onReject={onReject ? () => onReject(row.id) : undefined}
          />
        ))}
      </ul>
      {limit && rows.length > limit && (
        <p className="border-t border-white/6 px-3 py-2 text-xs text-muted-foreground">
          y {rows.length - limit} más — podrás revisarlos en el viaje
        </p>
      )}
    </div>
  );
}

function CandidateItem({
  row,
  checked,
  isRejected,
  onToggle,
  onAccept,
  onReject,
}: {
  row: ModoCandidateRow;
  checked: boolean;
  isRejected: boolean;
  onToggle: () => void;
  onAccept?: () => void;
  onReject?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const title = describeCandidate(row);
  const reason = reasonLabel(row);
  const currency = (row.currency_code ?? "COP") as CurrencyCode;
  const time = row.transaction_time?.slice(0, 5) ?? null;
  const rawDiffers = !!row.raw_description?.trim() && row.raw_description.trim() !== title;

  return (
    <li className={cn(isRejected && "opacity-60")}>
      <div className="flex items-center gap-3 px-3">
        <Checkbox
          checked={checked}
          onCheckedChange={onToggle}
          aria-label={`Incluir ${title}`}
        />
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            setEverOpened(true);
          }}
          aria-expanded={open}
          className={cn(ROW_EXPAND_TRIGGER_CLASS, "min-w-0 flex-1")}
        >
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate text-sm", open && "whitespace-normal break-words")}>{title}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {formatDate(row.transaction_date, "d MMM")}
              {time ? ` · ${time}` : ""}
              {row.account ? ` · ${row.account.name}` : ""}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-sm tabular-nums">{formatCurrency(row.amount ?? 0, currency)}</span>
            {isRejected ? (
              <span className="rounded-full border border-white/6 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                No fue del viaje
              </span>
            ) : reason ? (
              <span className="rounded-full border border-z-brass/30 bg-z-brass/10 px-1.5 py-0.5 text-[10px] text-z-brass">
                {reason}
              </span>
            ) : null}
          </span>
          <ChevronDown
            className={cn("size-4 shrink-0 text-z-sage-dark transition-transform", open && "rotate-180")}
          />
        </button>
      </div>

      <Expand open={open}>
        {everOpened && (
          <div className={cn(NEST_GUIDE_CLASS, "mx-3 mb-3 space-y-3")}>
            {rawDiffers && (
              <p className="break-words text-xs text-muted-foreground">
                <span className="text-z-sage-dark">Descripción original: </span>
                {row.raw_description}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <DetailCell label="Fecha y hora">
                <span className="font-medium">{formatDateTime(row.transaction_date, row.transaction_time, "d MMM · HH:mm")}</span>
              </DetailCell>
              <DetailCell label="Cuenta">
                <span className="font-medium">{row.account?.name ?? "—"}</span>
              </DetailCell>
              <DetailCell label="Categoría">
                <span className="font-medium">{row.category?.name_es ?? row.category?.name ?? "Sin categoría"}</span>
              </DetailCell>
              <DetailCell label="Destinatario">
                <span className="font-medium">{row.destinatario?.name ?? "—"}</span>
              </DetailCell>
              <DetailCell label="Origen">
                <span className="font-medium">{captureMethodLabel(row.capture_method)}</span>
              </DetailCell>
              <DetailCell label="Moneda">
                <span className="font-medium">{currency}</span>
              </DetailCell>
            </div>
            {row.notes && <p className="text-xs text-muted-foreground">Notas: {row.notes}</p>}
            {row.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {row.tags.map((t) => (
                  <TagChip key={t.id} tag={t} size="sm" />
                ))}
              </div>
            )}
            {row.location_id && <LocationLine locationId={row.location_id} />}
            <div className="flex flex-wrap items-center gap-2">
              {onAccept && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(BRASS_GHOST_BUTTON_CLASS, checked && !isRejected && "ring-1 ring-z-brass/40")}
                  onClick={onAccept}
                  aria-pressed={checked && !isRejected}
                >
                  <Check className="size-3.5" />
                  Sí, del viaje
                </Button>
              )}
              {onReject && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(GHOST_BUTTON_CLASS, isRejected && "ring-1 ring-white/20")}
                  onClick={onReject}
                  aria-pressed={isRejected}
                >
                  <X className="size-3.5" />
                  No fue del viaje
                </Button>
              )}
              <Link
                href={`/transactions/${row.id}`}
                className="ml-auto inline-flex items-center gap-1 text-xs text-z-brass hover:underline"
              >
                Ver movimiento <ExternalLink className="size-3" />
              </Link>
            </div>
          </div>
        )}
      </Expand>
    </li>
  );
}

/** Where it was paid — the strongest "was this the trip?" hint when a fix exists. */
function LocationLine({ locationId }: { locationId: string }) {
  const [location, setLocation] = useState<TransactionLocation | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    getTransactionLocation(locationId).then((res) => {
      if (!cancelled) setLocation(res.success ? res.data : null);
    });
    return () => {
      cancelled = true;
    };
  }, [locationId]);
  if (location === undefined) {
    return <p className="text-xs text-muted-foreground">Buscando ubicación…</p>;
  }
  if (!location) return null;
  const parts = [location.place_name, location.place_locality, location.place_country].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <p className="text-xs text-muted-foreground">
      <span className="text-z-sage-dark">Ubicación: </span>
      {parts.join(" · ")}
    </p>
  );
}
