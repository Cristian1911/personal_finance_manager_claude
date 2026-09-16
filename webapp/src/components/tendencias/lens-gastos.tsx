import type { CurrencyCode } from "@/types/domain";
import type { GastosData } from "./types";
import { CategoryTrendList } from "./category-trend-list";
import { TopRecipientsCard } from "./top-recipients-card";
import { FixedVariableCard } from "./fixed-variable-card";
import { TripsCard } from "./trips-card";

export function LensGastos({
  data,
  currency,
  windowFrom,
  windowTo,
}: {
  data: GastosData;
  currency: CurrencyCode;
  windowFrom: string;
  windowTo: string;
}) {
  return (
    <>
      <CategoryTrendList
        hierarchy={data.categoryHierarchy}
        currency={currency}
        windowFrom={windowFrom}
        windowTo={windowTo}
      />
      <TopRecipientsCard
        recipients={data.recipientsFull}
        currency={currency}
        windowFrom={windowFrom}
        windowTo={windowTo}
      />
      <TripsCard trips={data.trips} currency={currency} windowFrom={windowFrom} windowTo={windowTo} />
      <FixedVariableCard data={data.fixedVariable} currency={currency} />
    </>
  );
}
