import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WaterfallChart } from "@/components/charts/waterfall-chart";
import { getMonthlyCashflow, getCategorySpending } from "@/actions/charts";
import type { CurrencyCode } from "@/types/domain";

export async function FlujoWaterfall({
  month,
  currency,
}: {
  month: string | undefined;
  currency: CurrencyCode;
}) {
  const [cashflowData, categoryData] = await Promise.all([
    getMonthlyCashflow(month, currency),
    getCategorySpending(month, currency),
  ]);

  const current = cashflowData[cashflowData.length - 1];
  const income = current?.income ?? 0;
  const net = current?.net ?? 0;
  const categories = categoryData.map((c) => ({ name: c.name, amount: c.amount }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Flujo del mes</CardTitle>
        <p className="text-xs text-muted-foreground">Ingresos → Gastos → Neto</p>
      </CardHeader>
      <CardContent>
        <WaterfallChart income={income} categories={categories} net={net} currency={currency} />
      </CardContent>
    </Card>
  );
}
