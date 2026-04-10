import { View, Text } from "react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { MobileZone } from "../ui/MobileZone";
import { PANEL_INSET_CLASS } from "../../lib/constants/styles";
import type { DebtAccountInfo } from "../../lib/repositories/debt";

interface DeudasAccountsAccordionProps {
  accounts: DebtAccountInfo[];
  currency: CurrencyCode;
}

function getUtilizationColor(pct: number): string {
  if (pct >= 80) return "bg-z-debt";
  if (pct >= 50) return "bg-z-alert";
  return "bg-z-income";
}

export function DeudasAccountsAccordion({
  accounts,
  currency,
}: DeudasAccountsAccordionProps) {
  if (accounts.length === 0) return null;

  return (
    <MobileZone eyebrow="CUENTAS">
      <View className="gap-1.5">
        {accounts.map((account) => {
          const utilization = account.creditLimit > 0
            ? Math.round((account.balance / account.creditLimit) * 100)
            : 0;
          const barColor = getUtilizationColor(utilization);

          return (
            <View
              key={account.id}
              className={`${PANEL_INSET_CLASS} p-3`}
            >
              <View className="flex-row items-center justify-between mb-2">
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-inter-medium text-foreground" numberOfLines={1}>
                    {account.name}
                  </Text>
                  <Text className="text-[10px] font-inter text-muted-foreground">
                    {account.type === "CREDIT_CARD" ? "Tarjeta de credito" : "Prestamo"} · {account.interestRate}% EA
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-sm font-inter-semibold text-foreground">
                    {formatCurrency(account.balance, currency)}
                  </Text>
                  {account.creditLimit > 0 && (
                    <Text className="text-[10px] font-inter text-muted-foreground">
                      de {formatCurrency(account.creditLimit, currency)}
                    </Text>
                  )}
                </View>
              </View>

              {/* Progress bar */}
              {account.creditLimit > 0 && (
                <View className="h-2 rounded-full bg-white-6 overflow-hidden">
                  <View
                    className={`h-full rounded-full ${barColor}`}
                    style={{ width: `${Math.min(utilization, 100)}%` }}
                  />
                </View>
              )}

              {/* Payment info */}
              {(account.monthlyPayment > 0 || account.paymentDay) && (
                <View className="mt-2 flex-row justify-between">
                  {account.monthlyPayment > 0 && (
                    <Text className="text-[10px] font-inter text-muted-foreground">
                      Pago min: {formatCurrency(account.monthlyPayment, currency)}
                    </Text>
                  )}
                  {account.paymentDay && (
                    <Text className="text-[10px] font-inter text-muted-foreground">
                      Dia {account.paymentDay}
                    </Text>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </MobileZone>
  );
}
