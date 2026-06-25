import type { CurrencyCode } from "@/types/domain";
import type { CambiosData } from "./types";
import { MoversCard } from "./movers-card";
import { AnomaliesCard } from "./anomalies-card";
import { ForecastCard } from "./forecast-card";

export function LensCambios({ data, currency }: { data: CambiosData; currency: CurrencyCode }) {
  return (
    <>
      <MoversCard movers={data.movers} currency={currency} />
      <AnomaliesCard anomalies={data.anomalies} currency={currency} />
      <ForecastCard points={data.forecast} currentBalance={data.currentBalance} currency={currency} />
    </>
  );
}
