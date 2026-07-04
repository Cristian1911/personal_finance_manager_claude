import {
  getWishlistItemsWithFreshScores,
  getActiveNudges,
  getWishlistInsights,
  getPendingReflections,
} from "@/actions/wishlist";
import { getAccounts } from "@/actions/accounts";
import { getPreferredCurrency } from "@/actions/profile";
import { DeseosList } from "@/components/deseos/deseos-list";

export async function PlanTabDeseos() {
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
      {/* Mobile header comes from plan/page.tsx — no second MobileHeader here. */}
      <div>
        <h2 className="text-2xl font-semibold hidden lg:block">Deseos</h2>
        <p className="text-sm text-muted-foreground hidden lg:block">
          Lo que quieres comprar, evaluado contra tu realidad financiera
        </p>
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
