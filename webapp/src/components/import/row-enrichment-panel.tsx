"use client";

import { Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TagZonePicker } from "@/components/tags/tag-zone-picker";
import { cn } from "@/lib/utils";
import { BRASS_GHOST_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { describeRowShare, type RowEnrichment } from "@/lib/import/review-enrichment";
import type { ModoWithParticipants } from "@/types/domain";

const NONE = "__none__";

type Props = {
  value: RowEnrichment;
  /** The trip came from the active-trip default, not a pick. */
  isDefaultModo: boolean;
  direction: "INFLOW" | "OUTFLOW";
  modos: ModoWithParticipants[];
  onChange: (patch: Partial<RowEnrichment>) => void;
  onOpenShare: () => void;
  className?: string;
};

/** The per-row decisions of the import review: viaje, compartido con…, etiquetas, nota. */
export function RowEnrichmentPanel({ value, isDefaultModo, direction, modos, onChange, onOpenShare, className }: Props) {
  const shareLabel = describeRowShare(value.share);
  const isSpend = direction === "OUTFLOW";
  return (
    <div className={cn("space-y-2", className)}>
      {isSpend && modos.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-xs text-muted-foreground">Viaje</span>
          <div className="min-w-0 flex-1">
            <Select value={value.modoId ?? NONE} onValueChange={(v) => onChange({ modoId: v === NONE ? null : v })}>
              <SelectTrigger className="h-8 w-full text-xs" aria-label="Viaje o evento">
                <SelectValue placeholder="Sin viaje" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin viaje</SelectItem>
                {modos.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.emoji ? `${m.emoji} ` : ""}
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isDefaultModo && value.modoId && (
              <span className="mt-0.5 block text-[10px] text-muted-foreground">Sugerido · viaje activo</span>
            )}
          </div>
        </div>
      )}
      {isSpend && (
        <div className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-xs text-muted-foreground">Compartir</span>
          <button
            type="button"
            onClick={onOpenShare}
            aria-pressed={!!value.share}
            className={cn(
              "inline-flex h-8 min-w-0 max-w-full items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
              value.share ? BRASS_GHOST_BUTTON_CLASS : GHOST_BUTTON_CLASS,
            )}
          >
            <Users className="size-3.5 shrink-0" />
            <span className="truncate">{shareLabel ?? "Compartir con…"}</span>
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-xs text-muted-foreground">Etiquetas</span>
        <TagZonePicker
          selectedTagIds={value.tagIds}
          onSelectedTagIdsChange={(ids) => onChange({ tagIds: ids })}
          placeholder="Etiquetas"
          triggerClassName="h-8 text-xs"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-xs text-muted-foreground">Nota</span>
        <Input
          value={value.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          maxLength={280}
          placeholder="Opcional"
          className="h-8 text-xs"
          aria-label="Nota"
        />
      </div>
    </div>
  );
}
