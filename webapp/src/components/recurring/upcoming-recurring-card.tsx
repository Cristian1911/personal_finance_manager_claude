import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { frequencyLabel,
  isDebtAccountType,
} from "@zeta/shared";
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
            {upcoming.slice(0, 5).map((item, i) => {
              const acctType = item.template.account?.account_type;
              // An OUTFLOW on a debt account is a recurring charge, not an abono.
              const isDebtPayment =
                (isDebtAccountType(acctType)) &&
                item.template.direction === "INFLOW";
              const isIncome = item.template.direction === "INFLOW" && !isDebtPayment;
              return (
              <div
                key={`${item.template.id}-${item.next_date}-${i}`}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  {isIncome ? (
                    <ArrowDownLeft className="h-4 w-4 text-z-income" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-z-expense" />
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
                    isIncome ? "text-z-income" : ""
                  }`}
                >
                  {isIncome ? "+" : "-"}
                  {formatCurrency(
                    item.template.amount,
                    item.template.currency_code as CurrencyCode
                  )}
                </span>
              </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
