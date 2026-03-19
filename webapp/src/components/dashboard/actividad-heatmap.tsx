import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpendingHeatmap } from "@/components/charts/spending-heatmap";
import { getSpendingHeatmap } from "@/actions/spending-heatmap";
import type { CurrencyCode } from "@/types/domain";

export async function ActividadHeatmap({
  month,
  currency,
}: {
  month: string | undefined;
  currency: CurrencyCode;
}) {
  const heatmapData = await getSpendingHeatmap(month, currency);

  if (!heatmapData) {
    return (
      <Card>
        <CardContent className="p-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Mapa de actividad
          </p>
          <p className="text-sm text-muted-foreground">
            Importa transacciones para ver tu patrón de gasto.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Mapa de actividad</CardTitle>
        <p className="text-xs text-muted-foreground">
          Intensidad de gasto diario
        </p>
      </CardHeader>
      <CardContent>
        <SpendingHeatmap data={heatmapData} />
      </CardContent>
    </Card>
  );
}
