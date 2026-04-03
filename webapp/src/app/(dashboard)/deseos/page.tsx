import { connection } from "next/server";
import {
  getWishlistItemsWithFreshScores,
  getActiveNudges,
  getWishlistInsights,
  getPendingReflections,
} from "@/actions/wishlist";
import { getAccounts } from "@/actions/accounts";
import { getPreferredCurrency } from "@/actions/profile";
import { DeseosList } from "@/components/deseos/deseos-list";

export default async function DeseosPage() {
  await connection();

  const [items, nudges, insights, pendingReflections, accountsResult, currency] =
    await Promise.all([
      getWishlistItemsWithFreshScores(),
      getActiveNudges(),
      getWishlistInsights(),
      getPendingReflections(),
      getAccounts(),
      getPreferredCurrency(),
    ]);

  const accounts = accountsResult.success ? accountsResult.data : [];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          Plan
        </p>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
            Deseos
          </h1>
          <p className="text-sm text-muted-foreground lg:text-base">
            Lo que quieres comprar, evaluado contra tu realidad financiera
          </p>
        </div>
      </div>
      <DeseosList
        items={items}
        nudges={nudges}
        insights={insights}
        pendingReflections={pendingReflections}
        accounts={accounts}
        currency={currency}
      />
    </div>
  );
}
