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
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { PAGE_STACK_CLASS } from "@/lib/constants/styles";

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
    <div className={PAGE_STACK_CLASS}>
      <MobilePageHeader title="Deseos" backHref="/plan" />

      <div className="space-y-1 lg:hidden">
        <SectionEyebrow>Plan</SectionEyebrow>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deseos</h1>
          <p className="text-sm text-muted-foreground">
            Lo que quieres comprar, evaluado contra tu realidad financiera
          </p>
        </div>
      </div>

      <div className="hidden lg:block space-y-1">
        <SectionEyebrow>Plan</SectionEyebrow>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Deseos</h1>
          <p className="text-muted-foreground">
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
