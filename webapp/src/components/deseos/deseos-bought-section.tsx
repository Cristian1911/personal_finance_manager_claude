"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import type { ScoredWishlistItem } from "@/actions/wishlist";
import type { CurrencyCode } from "@/types/domain";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";

type DeseosBoughtSectionProps = {
  items: ScoredWishlistItem[];
  currency: CurrencyCode;
};

export function DeseosBoughtSection({
  items,
  currency,
}: DeseosBoughtSectionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {expanded ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
        Comprados ({items.length})
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-white/6 bg-z-surface-2/40 px-4 py-3"
            >
              <Check className="size-4 flex-shrink-0 text-z-income" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{item.name}</p>
                {item.bought_at && (
                  <p className="text-xs text-muted-foreground">
                    {formatDate(item.bought_at)}
                  </p>
                )}
              </div>
              <span className="flex-shrink-0 text-sm tabular-nums text-muted-foreground">
                {formatCurrency(item.amount, currency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
