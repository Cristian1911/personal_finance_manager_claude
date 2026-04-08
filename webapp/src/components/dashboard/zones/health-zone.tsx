import { getHealthMeters } from "@/actions/health-meters";
import { HealthScoreSection } from "@/components/dashboard/health-score-section";
import { WidgetSlot } from "@/components/dashboard/widget-slot";
import type { CurrencyCode } from "@/types/domain";

interface HealthZoneProps {
  currency: CurrencyCode;
  month: string | undefined;
}

export async function HealthZone({ currency, month }: HealthZoneProps) {
  const healthMetersData = await getHealthMeters(currency, month);

  return (
    <WidgetSlot widgetId="health-score">
      <HealthScoreSection data={healthMetersData} />
    </WidgetSlot>
  );
}
