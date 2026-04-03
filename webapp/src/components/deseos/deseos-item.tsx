"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import {
  deleteWishlistItem,
  markWishlistItemBought,
  scoreWishlistItem,
} from "@/actions/wishlist";
import type { ScoredWishlistItem } from "@/actions/wishlist";
import type { Account, CurrencyCode } from "@/types/domain";
import { formatCurrency } from "@/lib/utils/currency";
import { formatRelativeDate } from "@/lib/utils/date";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DeseosEnrichDrawer } from "./deseos-enrich-drawer";

const URGENCY_LABELS: Record<string, string> = {
  NECESSARY: "Necesario",
  USEFUL: "Util",
  IMPULSE: "Impulso",
};

const DESIRE_TYPE_LABELS: Record<string, string> = {
  long_held: "Hace rato",
  recent: "Reciente",
  spontaneous: "Espontaneo",
};

function trafficLightColor(score: number | null): string {
  if (score == null) return "bg-muted-foreground";
  if (score >= 55) return "bg-green-400";
  if (score >= 35) return "bg-yellow-400";
  return "bg-red-400";
}

function verdictText(verdict: string | null): string | null {
  if (!verdict) return null;
  switch (verdict) {
    case "BUY":
      return "Puedes comprarlo";
    case "BUY_WITH_CAUTION":
      return "Puedes, con precaucion";
    case "WAIT":
      return "Mejor esperar";
    case "NOT_RECOMMENDED":
      return "No es buen momento";
    default:
      return null;
  }
}

function verdictTextColor(verdict: string | null): string {
  if (!verdict) return "text-muted-foreground";
  switch (verdict) {
    case "BUY":
    case "BUY_WITH_CAUTION":
      return "text-green-400";
    case "WAIT":
      return "text-yellow-400";
    case "NOT_RECOMMENDED":
      return "text-red-400";
    default:
      return "text-muted-foreground";
  }
}

type DeseosItemProps = {
  item: ScoredWishlistItem;
  currency: CurrencyCode;
  paymentAccounts: Account[];
  onDeleted: (id: string) => void;
};

export function DeseosItem({
  item,
  currency,
  paymentAccounts,
  onDeleted,
}: DeseosItemProps) {
  const [isPending, startTransition] = useTransition();
  const [enrichOpen, setEnrichOpen] = useState(false);
  const [localScoreError, setLocalScoreError] = useState(item.scoreError);

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteWishlistItem(item.id);
      if (result.success) {
        onDeleted(item.id);
      }
    });
  }

  function handleBought() {
    startTransition(async () => {
      await markWishlistItemBought(item.id);
    });
  }

  function handleRetryScore() {
    setLocalScoreError(false);
    startTransition(async () => {
      const result = await scoreWishlistItem(item.id);
      if (!result.success) {
        setLocalScoreError(true);
      }
    });
  }

  const isGreen =
    item.freshVerdict === "BUY" || item.freshVerdict === "BUY_WITH_CAUTION";

  return (
    <>
      <Card className="border-white/6 bg-z-surface-2/80">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            {/* Traffic light dot */}
            <div className="mt-1.5 flex-shrink-0">
              {item.enriched ? (
                <div
                  className={`size-3 rounded-full ${trafficLightColor(item.freshScore)}`}
                />
              ) : (
                <span className="text-sm font-medium text-muted-foreground">
                  ?
                </span>
              )}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="truncate text-sm font-medium">{item.name}</h3>
                <span className="flex-shrink-0 text-sm font-semibold tabular-nums">
                  {formatCurrency(item.amount, currency)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{formatRelativeDate(item.created_at)}</span>

                {localScoreError ? (
                  <span className="text-red-400">No se pudo evaluar</span>
                ) : (
                  verdictText(item.freshVerdict) && (
                    <span className={verdictTextColor(item.freshVerdict)}>
                      {verdictText(item.freshVerdict)}
                    </span>
                  )
                )}
              </div>

              {/* Tags */}
              {(item.urgency || item.desire_type) && (
                <div className="flex flex-wrap gap-1.5">
                  {item.urgency && (
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-muted-foreground">
                      {URGENCY_LABELS[item.urgency] ?? item.urgency}
                    </span>
                  )}
                  {item.desire_type && (
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-muted-foreground">
                      {DESIRE_TYPE_LABELS[item.desire_type] ?? item.desire_type}
                    </span>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {!item.enriched && (
                  <Button
                    size="xs"
                    variant="outline"
                    className="border-white/8 text-xs"
                    onClick={() => setEnrichOpen(true)}
                  >
                    Completar
                  </Button>
                )}
                {item.enriched && isGreen && (
                  <Button
                    size="xs"
                    className="bg-green-900/30 text-green-400 border border-green-900/30 hover:bg-green-900/50 text-xs"
                    onClick={handleBought}
                    disabled={isPending}
                  >
                    Comprado
                  </Button>
                )}
                {localScoreError && (
                  <Button
                    size="xs"
                    variant="outline"
                    className="border-white/8 text-xs"
                    onClick={handleRetryScore}
                    disabled={isPending}
                  >
                    Reintentar
                  </Button>
                )}
                {item.freshScore != null && (
                  <span className="ml-auto text-xs font-medium tabular-nums text-muted-foreground">
                    {item.freshScore}
                  </span>
                )}
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="ml-auto text-muted-foreground hover:text-red-400"
                  onClick={handleDelete}
                  disabled={isPending}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <DeseosEnrichDrawer
        item={item}
        open={enrichOpen}
        onOpenChange={setEnrichOpen}
        paymentAccounts={paymentAccounts}
      />
    </>
  );
}
