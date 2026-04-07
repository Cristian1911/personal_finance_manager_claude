"use client";

import { useState } from "react";
import type {
  ScoredWishlistItem,
  WishlistNudge,
  WishlistInsight,
} from "@/actions/wishlist";
import type { Account, CurrencyCode, WishlistItem } from "@/types/domain";
import { DeseosItem } from "./deseos-item";
import { DeseosQuickAdd } from "./deseos-quick-add";
import { DeseosNudgeBanner } from "./deseos-nudge-banner";
import { DeseosReflectionCard } from "./deseos-reflection-card";
import { DeseosInsights } from "./deseos-insights";
import { DeseosBoughtSection } from "./deseos-bought-section";

type DeseosListProps = {
  items: ScoredWishlistItem[];
  nudges: WishlistNudge[];
  insights: WishlistInsight[];
  pendingReflections: WishlistItem[];
  accounts: Account[];
  currency: CurrencyCode;
};

export function DeseosList({
  items,
  nudges,
  insights,
  pendingReflections,
  accounts,
  currency,
}: DeseosListProps) {
  const [optimisticDeleted, setOptimisticDeleted] = useState<Set<string>>(
    new Set()
  );

  const activeItems = items
    .filter((i) => i.status === "wishlist" && !optimisticDeleted.has(i.id))
    .sort((a, b) => {
      // Enriched items first (sorted by score desc), unenriched last
      if (a.enriched && !b.enriched) return -1;
      if (!a.enriched && b.enriched) return 1;
      return (b.freshScore ?? -1) - (a.freshScore ?? -1);
    });

  const boughtItems = items.filter(
    (i) =>
      (i.status === "bought" || i.status === "reflected" || i.status === "archived") &&
      !optimisticDeleted.has(i.id)
  );

  const paymentAccounts = accounts.filter(
    (a) => a.is_active && a.account_type !== "LOAN"
  );

  function handleDeleted(id: string) {
    setOptimisticDeleted((prev) => new Set(prev).add(id));
  }

  return (
    <div className="space-y-6">
      {nudges.length > 0 &&
        nudges.map((nudge) => (
          <DeseosNudgeBanner key={nudge.itemId} nudge={nudge} />
        ))}

      {pendingReflections.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground">
            Reflexiones pendientes
          </h2>
          {pendingReflections.map((item) => (
            <DeseosReflectionCard
              key={item.id}
              item={item}
              currency={currency}
            />
          ))}
        </div>
      )}

      <DeseosQuickAdd currency={currency} />

      {activeItems.length > 0 ? (
        <div className="space-y-3">
          {activeItems.map((item) => (
            <DeseosItem
              key={item.id}
              item={item}
              currency={currency}
              paymentAccounts={paymentAccounts}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      ) : (
        !optimisticDeleted.size && (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">
              No tienes deseos activos. Agrega uno para empezar.
            </p>
          </div>
        )
      )}

      {insights.length > 0 && <DeseosInsights insights={insights} />}

      {boughtItems.length > 0 && (
        <DeseosBoughtSection items={boughtItems} currency={currency} />
      )}
    </div>
  );
}
