"use client";

import { DetailCell } from "@/components/mobile/v2/deudas/detail-cell";
import { TagChip } from "@/components/tags/tag-chip";
import { formatDateTime } from "@/lib/utils/date";
import { captureMethodLabel } from "@/lib/constants/capture-methods";

export interface TxDetailGridProps {
  /** Title already shown on the row — the raw description is printed only when it differs. */
  title: string;
  raw_description?: string | null;
  transaction_date: string;
  transaction_time?: string | null;
  currency: string;
  account?: { name: string } | null;
  category?: { name: string; name_es: string | null } | null;
  destinatario?: { name: string } | null;
  capture_method?: string | null;
  notes?: string | null;
  tags?: Array<{ id: string; name: string; color: string | null }>;
}

/**
 * The detail a row expands to — the same grid in the review tray and in the
 * trip's own list, so "what is this movement?" reads identically in both.
 */
export function TxDetailGrid({
  title,
  raw_description,
  transaction_date,
  transaction_time,
  currency,
  account,
  category,
  destinatario,
  capture_method,
  notes,
  tags,
}: TxDetailGridProps) {
  const rawDiffers = !!raw_description?.trim() && raw_description.trim() !== title;
  return (
    <div className="space-y-3">
      {rawDiffers && (
        <p className="break-words text-xs text-muted-foreground">
          <span className="text-z-sage-dark">Descripción original: </span>
          {raw_description}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <DetailCell label="Fecha y hora">
          <span className="font-medium">{formatDateTime(transaction_date, transaction_time ?? null, "d MMM · HH:mm")}</span>
        </DetailCell>
        <DetailCell label="Cuenta">
          <span className="font-medium">{account?.name ?? "—"}</span>
        </DetailCell>
        <DetailCell label="Categoría">
          <span className="font-medium">{category?.name_es ?? category?.name ?? "Sin categoría"}</span>
        </DetailCell>
        <DetailCell label="Destinatario">
          <span className="font-medium">{destinatario?.name ?? "—"}</span>
        </DetailCell>
        <DetailCell label="Origen">
          <span className="font-medium">{captureMethodLabel(capture_method)}</span>
        </DetailCell>
        <DetailCell label="Moneda">
          <span className="font-medium">{currency}</span>
        </DetailCell>
      </div>
      {notes && <p className="text-xs text-muted-foreground">Notas: {notes}</p>}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((t) => (
            <TagChip key={t.id} tag={t} size="sm" />
          ))}
        </div>
      )}
    </div>
  );
}
