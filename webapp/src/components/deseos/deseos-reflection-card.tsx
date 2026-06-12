"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { submitReflection } from "@/actions/wishlist";
import type { CurrencyCode, WishlistItem } from "@/types/domain";
import { formatCurrency } from "@/lib/utils/currency";
import { formatRelativeDate } from "@/lib/utils/date";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type DeseosReflectionCardProps = {
  item: WishlistItem;
  currency: CurrencyCode;
};

export function DeseosReflectionCard({
  item,
  currency,
}: DeseosReflectionCardProps) {
  const [isPending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState(false);
  const [worthIt, setWorthIt] = useState<boolean | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (dismissed) return null;

  const reflectionStage: "14_day" | "60_day" =
    item.status === "reflected" ? "60_day" : "14_day";

  function handleSubmit() {
    if (worthIt === null || rating === 0) {
      setError("Indica si valió la pena y una calificación");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await submitReflection({
        wishlist_item_id: item.id,
        reflection_stage: reflectionStage,
        worth_it: worthIt,
        rating,
        note: note || undefined,
      });
      if (result.success) {
        setDismissed(true);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Card className="border-white/6 bg-z-surface-2/80">
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-medium">{item.name}</h3>
          <span className="flex-shrink-0 text-sm font-semibold tabular-nums">
            {formatCurrency(item.amount, currency)}
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          Comprado {item.bought_at ? formatRelativeDate(item.bought_at) : ""}
          {reflectionStage === "60_day" && " — seguimiento"}
        </p>

        {/* Worth it? */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            ¿Valió la pena?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setWorthIt(true)}
              className={`rounded-lg border px-4 py-1.5 text-sm transition-colors ${
                worthIt === true
                  ? "border-z-income/25 bg-z-income/15 text-z-income"
                  : "border-white/10 text-muted-foreground hover:border-white/20"
              }`}
            >
              Sí
            </button>
            <button
              type="button"
              onClick={() => setWorthIt(false)}
              className={`rounded-lg border px-4 py-1.5 text-sm transition-colors ${
                worthIt === false
                  ? "border-z-debt/25 bg-z-debt/15 text-z-debt"
                  : "border-white/10 text-muted-foreground hover:border-white/20"
              }`}
            >
              No
            </button>
          </div>
        </div>

        {/* Rating */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Calificación
          </p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className="p-0.5 transition-colors"
              >
                <Star
                  className={`size-5 ${
                    n <= rating
                      ? "fill-z-brass text-z-brass"
                      : "text-muted-foreground"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Note */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Nota (opcional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="¿Qué aprendiste?"
            autoComplete="off"
            className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-z-brass focus:outline-none"
          />
        </div>

        {error && <p className="text-xs text-z-debt">{error}</p>}

        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDismissed(true)}
            disabled={isPending}
          >
            Después
          </Button>
          <Button
            size="sm"
            className={BRASS_BUTTON_CLASS}
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending ? "Guardando..." : "Enviar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
