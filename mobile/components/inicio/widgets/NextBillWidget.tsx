import type { CurrencyCode } from "@zeta/shared";
import { renderUpcomingRecurringWidget } from "./_shared";
import type {
  NextBill,
  UpcomingItem,
} from "../../../lib/dashboard/useDashboardData";

export interface NextBillWidgetData {
  bill: NextBill;
  upcoming: UpcomingItem[];
  currency: CurrencyCode;
}

export function renderNextBillWidget({
  bill,
  upcoming,
  currency,
}: NextBillWidgetData) {
  return renderUpcomingRecurringWidget({
    item: bill,
    upcoming,
    currency,
    tone: "debt",
    eyebrow: "Próximo pago",
    emptyLabel: "Sin pagos próximos",
    todayLabel: "vence hoy",
    detailHeading: "Pagos programados",
    detailEmpty: "No tienes pagos recurrentes configurados",
    accessibilityLabel: "Próximo pago",
  });
}
