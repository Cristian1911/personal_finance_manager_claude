import { getAccounts } from "@/actions/accounts";
import { getForeignDebtFxSignal } from "@/lib/debt/fx-rate-signal";
import { FxRateStrip } from "@/components/dashboard/fx-rate-strip";
import type { CurrencyCode } from "@/types/domain";

/**
 * Streams the FX strip behind its own Suspense boundary: the rate is cached
 * daily, but a cold cache means a CDN round-trip that must never hold the
 * hero. Renders nothing without foreign-currency debt.
 */
export async function FxRateSection({
  currency,
  className,
}: {
  currency: CurrencyCode;
  className?: string;
}) {
  const accountsResult = await getAccounts();
  if (!accountsResult.success) return null;
  const signal = await getForeignDebtFxSignal(accountsResult.data, currency);
  if (!signal) return null;
  return <FxRateStrip signal={signal} className={className} />;
}
