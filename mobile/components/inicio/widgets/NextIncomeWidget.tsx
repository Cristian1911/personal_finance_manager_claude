import type { CurrencyCode } from "@zeta/shared";
import { renderUpcomingRecurringWidget } from "./_shared";
import type {
  NextIncome,
  UpcomingItem,
} from "../../../lib/dashboard/useDashboardData";

export interface NextIncomeWidgetData {
  income: NextIncome;
  upcoming: UpcomingItem[];
  currency: CurrencyCode;
}

export function renderNextIncomeWidget({
  income,
  upcoming,
  currency,
}: NextIncomeWidgetData) {
  return renderUpcomingRecurringWidget({
    item: income,
    upcoming,
    currency,
    tone: "income",
    eyebrow: "Próximo ingreso",
    emptyLabel: "Sin ingresos próximos",
    todayLabel: "llega hoy",
    detailHeading: "Ingresos esperados",
    detailEmpty: "No tienes ingresos recurrentes configurados",
    accessibilityLabel: "Próximo ingreso",
  });
}
