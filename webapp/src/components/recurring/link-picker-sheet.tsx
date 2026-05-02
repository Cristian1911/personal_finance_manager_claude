"use client";

import { useState } from "react";
import { CalendarPlus, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { BRASS_BUTTON_CLASS, MOBILE_SHEET_SAFE_AREA_CLASS, SECTION_EYEBROW_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode } from "@/types/domain";

export interface LinkCandidate {
  id: string;
  label: string;
  sublabel: string;
  amount: number;
  currencyCode: string;
  direction: "INFLOW" | "OUTFLOW";
  matchScore: number;
}

interface LinkPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  candidates: LinkCandidate[];
  onConfirm: (selectedId: string) => void;
  isPending: boolean;
  showAllLabel?: string;
  onShowAll?: () => void;
  isLoadingAll?: boolean;
  /** Secondary action: offer to create a brand-new template from this tx. */
  onCreateNew?: () => void;
}

export function LinkPickerSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  candidates,
  onConfirm,
  isPending,
  showAllLabel,
  onShowAll,
  isLoadingAll,
  onCreateNew,
}: LinkPickerSheetProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSelectedId(null);
      setSearch("");
    }
    onOpenChange(next);
  };

  const filtered = search
    ? candidates.filter((c) =>
        c.label.toLowerCase().includes(search.toLowerCase())
      )
    : candidates;

  const bestMatch = filtered.length > 0 ? filtered[0] : null;
  const rest = filtered.slice(1);

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className={MOBILE_SHEET_SAFE_AREA_CLASS}>
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{subtitle}</DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-2">
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-4">
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No se encontraron coincidencias
            </p>
          )}

          {bestMatch && (
            <>
              <p className={cn(SECTION_EYEBROW_CLASS, "mb-1 text-z-income")}>
                Mejor coincidencia
              </p>
              <CandidateRow
                candidate={bestMatch}
                isSelected={selectedId === bestMatch.id}
                isBest
                onSelect={() =>
                  setSelectedId(selectedId === bestMatch.id ? null : bestMatch.id)
                }
              />
            </>
          )}

          {rest.length > 0 && (
            <>
              <p className={cn(SECTION_EYEBROW_CLASS, "mb-1 mt-3")}>
                Otras opciones
              </p>
              {rest.map((c) => (
                <CandidateRow
                  key={c.id}
                  candidate={c}
                  isSelected={selectedId === c.id}
                  isBest={false}
                  onSelect={() =>
                    setSelectedId(selectedId === c.id ? null : c.id)
                  }
                />
              ))}
            </>
          )}

          {onShowAll && showAllLabel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onShowAll}
              disabled={isLoadingAll}
              className="mt-3 w-full text-z-brass"
            >
              {isLoadingAll ? "Cargando..." : showAllLabel}
            </Button>
          )}

          {onCreateNew && (
            <button
              type="button"
              onClick={onCreateNew}
              className="mt-3 flex w-full items-center gap-3 rounded-lg border border-dashed border-z-brass/30 bg-z-brass/5 px-3 py-3 text-left transition-colors hover:bg-z-brass/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-z-brass/60"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-z-brass/30 bg-z-brass/10">
                <CalendarPlus className="size-4 text-z-brass" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-z-brass">
                  Crear nueva recurrente
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Promueve esta transacción a una plantilla mensual
                </p>
              </div>
            </button>
          )}
        </div>

        <DrawerFooter>
          <Button
            onClick={() => selectedId && onConfirm(selectedId)}
            disabled={!selectedId || isPending}
            className={cn(BRASS_BUTTON_CLASS, "w-full")}
          >
            <Link2 className="mr-2 size-4" />
            {isPending ? "Vinculando..." : "Vincular"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function CandidateRow({
  candidate,
  isSelected,
  isBest,
  onSelect,
}: {
  candidate: LinkCandidate;
  isSelected: boolean;
  isBest: boolean;
  onSelect: () => void;
}) {
  const scorePercent = Math.round(candidate.matchScore * 100);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-z-brass/50",
        isSelected
          ? "bg-z-brass/10 ring-1 ring-z-brass/30"
          : "hover:bg-white/[0.03]",
        isBest && !isSelected && "border-l-2 border-l-z-income bg-z-income/[0.04]"
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{candidate.label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {candidate.sublabel}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={cn(
            "text-sm font-semibold tabular-nums",
            candidate.direction === "INFLOW" && "text-z-income"
          )}
        >
          {candidate.direction === "INFLOW" ? "+" : "-"}
          {formatCurrency(candidate.amount, candidate.currencyCode as CurrencyCode)}
        </p>
        {isBest && scorePercent > 0 && (
          <p className="text-[10px] font-medium text-z-income">
            {scorePercent}% coincidencia
          </p>
        )}
      </div>
    </button>
  );
}
