import Link from "next/link";
import { ArrowRight, Heart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import type { WishlistItem, CurrencyCode } from "@/types/domain";
import type { WishlistNudge } from "@/actions/wishlist";

function getScoreDot(score: number | null): string {
  if (score == null) return "bg-muted-foreground/40";
  if (score >= 55) return "bg-green-400";
  if (score >= 35) return "bg-yellow-400";
  return "bg-red-400";
}

function getScoreTextColor(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 55) return "text-green-400";
  if (score >= 35) return "text-yellow-400";
  return "text-red-400";
}

interface DeseosWidgetProps {
  items: WishlistItem[];
  totalCount: number;
  readyCount: number;
  nudge: WishlistNudge | null;
  currency: CurrencyCode;
}

export function DeseosWidget({ items, totalCount, readyCount, nudge, currency }: DeseosWidgetProps) {
  const topItem = items[0];
  const secondItem = items[1];

  return (
    <Card className="border-white/6 bg-z-surface-2/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-z-sage-dark" />
          <CardTitle className="text-sm font-semibold">Deseos</CardTitle>
        </div>
        <Link href="/deseos" className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
          Ver todos
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {!topItem ? (
          <p className="py-3 text-center text-xs text-muted-foreground">Sin deseos aún</p>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{totalCount} {totalCount === 1 ? "item" : "items"}</span>
              {readyCount > 0 && (
                <span className="text-green-400">{readyCount} listo{readyCount > 1 ? "s" : ""}</span>
              )}
            </div>
            <div className="rounded-lg border border-green-900/30 bg-gradient-to-br from-green-950/20 to-z-surface-2/80 p-3">
              <div className="flex items-center gap-2.5">
                <div className={`size-2.5 shrink-0 rounded-full ${getScoreDot(topItem.last_score)}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{topItem.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatCurrency(Number(topItem.amount), topItem.currency_code as CurrencyCode)}
                    {topItem.last_score != null && ` · Score ${topItem.last_score}`}
                  </p>
                </div>
              </div>
              {nudge && nudge.itemId === topItem.id && (
                <p className="mt-2 text-[11px] text-green-400">{nudge.message}</p>
              )}
            </div>
            {secondItem && (
              <div className="flex items-center gap-2.5 py-1">
                <div className={`size-2.5 shrink-0 rounded-full ${getScoreDot(secondItem.last_score)}`} />
                <p className="flex-1 truncate text-xs text-muted-foreground">
                  {secondItem.name} · {formatCurrency(Number(secondItem.amount), secondItem.currency_code as CurrencyCode)}
                </p>
                {secondItem.last_score != null && (
                  <span className={`text-[11px] ${getScoreTextColor(secondItem.last_score)}`}>{secondItem.last_score}</span>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
