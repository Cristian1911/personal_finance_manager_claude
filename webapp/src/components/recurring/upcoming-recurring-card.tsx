import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { frequencyLabel } from "@venti5/shared";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { CurrencyCode, UpcomingRecurrence } from "@/types/domain";

export function UpcomingRecurringCard({
  upcoming,
}: {
  upcoming: UpcomingRecurrence[];
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Próximos recurrentes</CardTitle>
        <Link
          href="/recurrentes"
          className="text-sm text-primary hover:underline"
        >
          Ver todos
        </Link>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay pagos recurrentes próximos.{" "}
            <Link href="/recurrentes" className="text-primary hover:underline">
              Crear uno
            </Link>
          </p>
        ) : (
          <div className="space-y-3">
            {upcoming.slice(0, 5).map((item, i) => (
              <div
                key={`${item.template.id}-${item.next_date}-${i}`}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  {item.template.direction === "INFLOW" ? (
                    <ArrowDownLeft className="h-4 w-4 text-green-500" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-orange-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {item.template.merchant_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(item.next_date)} &middot;{" "}
                      {frequencyLabel(item.template.frequency)}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-sm font-medium ${
                    item.template.direction === "INFLOW" ? "text-green-600" : ""
                  }`}
                >
                  {item.template.direction === "INFLOW" ? "+" : "-"}
                  {formatCurrency(
                    item.template.amount,
                    item.template.currency_code as CurrencyCode
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
