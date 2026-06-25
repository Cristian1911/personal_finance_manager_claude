import type { CurrencyCode } from "@/types/domain";
import type { GastosData } from "./types";
import { CategoryTrendList } from "./category-trend-list";
import { TopRecipientsCard } from "./top-recipients-card";
import { FixedVariableCard } from "./fixed-variable-card";

export function LensGastos({ data, currency }: { data: GastosData; currency: CurrencyCode }) {
  return (
    <>
      <CategoryTrendList categories={data.categories} currency={currency} />
      <TopRecipientsCard recipients={data.recipients} currency={currency} />
      <FixedVariableCard data={data.fixedVariable} currency={currency} />
    </>
  );
}
