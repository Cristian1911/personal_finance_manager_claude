import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Plus } from "lucide-react-native";
import { formatCurrency, formatDate, type CurrencyCode } from "@zeta/shared";
import type { OccurrenceWithTemplate } from "../../lib/repositories/recurring";
import { AnimatedAccordion } from "../ui/AnimatedAccordion";
import { PANEL_INSET_CLASS } from "../../lib/constants/styles";
import { COLORS } from "../../lib/constants/colors";

interface PlanExpandableChipsProps {
  incomes: OccurrenceWithTemplate[];
  payments: OccurrenceWithTemplate[];
  currency: CurrencyCode;
}

type ChipType = "income" | "payment" | null;

export function PlanExpandableChips({
  incomes,
  payments,
  currency,
}: PlanExpandableChipsProps) {
  const [active, setActive] = useState<ChipType>(null);

  const toggle = (type: ChipType) => setActive((prev) => (prev === type ? null : type));

  const nextIncome = incomes[0] ?? null;
  const nextPayment = payments[0] ?? null;

  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        {/* Próximo ingreso chip */}
        <Pressable
          onPress={() => toggle("income")}
          className={`${PANEL_INSET_CLASS} flex-1 p-3 ${active === "income" ? "border-z-income/50 bg-z-income/10" : ""} ${active === "payment" ? "opacity-50" : ""}`}
          style={active === "income" ? { borderColor: "rgba(92,184,138,0.5)", backgroundColor: "rgba(92,184,138,0.1)" } : undefined}
        >
          {nextIncome ? (
            <>
              <Text className="text-[18px] font-inter-bold text-z-income">
                {formatCurrency(nextIncome.expected_amount, currency)}
              </Text>
              <Text className="text-[10px] font-inter-medium text-z-income mt-0.5">
                Proximo ingreso
              </Text>
              <Text className="text-[9px] font-inter text-muted-foreground">
                · {formatDate(nextIncome.occurrence_date, "dd MMM")}
              </Text>
            </>
          ) : (
            <>
              <View className="flex-row items-center gap-1">
                <Plus size={14} color={COLORS.income} />
                <Text className="text-xs font-inter-semibold text-z-income">
                  Mapear ingreso
                </Text>
              </View>
              <Text className="text-[10px] font-inter text-muted-foreground mt-1">
                Agrega un ingreso recurrente
              </Text>
            </>
          )}
        </Pressable>

        {/* Próximo pago chip */}
        <Pressable
          onPress={() => toggle("payment")}
          className={`${PANEL_INSET_CLASS} flex-1 p-3 ${active === "income" ? "opacity-50" : ""}`}
          style={active === "payment" ? { borderColor: "rgba(224,85,69,0.5)", backgroundColor: "rgba(224,85,69,0.1)" } : undefined}
        >
          {nextPayment ? (
            <>
              <Text className="text-[18px] font-inter-bold text-z-debt">
                {formatCurrency(nextPayment.expected_amount, currency)}
              </Text>
              <Text className="text-[10px] font-inter-medium text-z-debt mt-0.5">
                Proximo pago
              </Text>
              <Text className="text-[9px] font-inter text-muted-foreground">
                · {formatDate(nextPayment.occurrence_date, "dd MMM")}
              </Text>
            </>
          ) : (
            <>
              <View className="flex-row items-center gap-1">
                <Plus size={14} color={COLORS.debt} />
                <Text className="text-xs font-inter-semibold text-z-debt">
                  Mapear pago
                </Text>
              </View>
              <Text className="text-[10px] font-inter text-muted-foreground mt-1">
                Agrega un pago recurrente
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Expanded list */}
      <AnimatedAccordion expanded={active !== null} estimatedHeight={200}>
        {active === "income" && (
          <View className={`${PANEL_INSET_CLASS} p-3`} style={{ borderColor: "rgba(92,184,138,0.2)", backgroundColor: "rgba(92,184,138,0.05)" }}>
            <Text className="text-[10px] font-inter-bold uppercase tracking-[3px] text-z-income mb-2">
              Ingresos esperados
            </Text>
            {incomes.length > 0 ? (
              <>
                {incomes.map((item) => (
                  <View key={item.id} className="flex-row items-center justify-between py-2 border-b border-white-6">
                    <View>
                      <Text className="text-xs font-inter-medium text-foreground">
                        {item.merchant_name ?? item.description ?? "Ingreso"}
                      </Text>
                      <Text className="text-[10px] font-inter text-muted-foreground">
                        {formatDate(item.occurrence_date, "dd MMM yyyy")}
                      </Text>
                    </View>
                    <Text className="text-sm font-inter-semibold text-z-income">
                      {formatCurrency(item.expected_amount, currency)}
                    </Text>
                  </View>
                ))}
                <View className="flex-row justify-between mt-2 pt-2 border-t border-white-6">
                  <Text className="text-xs font-inter text-muted-foreground">Total</Text>
                  <Text className="text-xs font-inter-bold text-z-income">
                    {formatCurrency(incomes.reduce((s, i) => s + i.expected_amount, 0), currency)}
                  </Text>
                </View>
              </>
            ) : (
              <Text className="text-xs font-inter text-muted-foreground text-center py-3">
                No tienes ingresos recurrentes configurados
              </Text>
            )}
          </View>
        )}
        {active === "payment" && (
          <View className={`${PANEL_INSET_CLASS} p-3`} style={{ borderColor: "rgba(224,85,69,0.2)", backgroundColor: "rgba(224,85,69,0.05)" }}>
            <Text className="text-[10px] font-inter-bold uppercase tracking-[3px] text-z-debt mb-2">
              Pagos programados
            </Text>
            {payments.length > 0 ? (
              <>
                {payments.map((item) => (
                  <View key={item.id} className="flex-row items-center justify-between py-2 border-b border-white-6">
                    <View>
                      <Text className="text-xs font-inter-medium text-foreground">
                        {item.merchant_name ?? item.description ?? "Pago"}
                      </Text>
                      <Text className="text-[10px] font-inter text-muted-foreground">
                        {formatDate(item.occurrence_date, "dd MMM yyyy")}
                      </Text>
                    </View>
                    <Text className="text-sm font-inter-semibold text-z-debt">
                      {formatCurrency(item.expected_amount, currency)}
                    </Text>
                  </View>
                ))}
                <View className="flex-row justify-between mt-2 pt-2 border-t border-white-6">
                  <Text className="text-xs font-inter text-muted-foreground">Total</Text>
                  <Text className="text-xs font-inter-bold text-z-debt">
                    {formatCurrency(payments.reduce((s, i) => s + i.expected_amount, 0), currency)}
                  </Text>
                </View>
              </>
            ) : (
              <Text className="text-xs font-inter text-muted-foreground text-center py-3">
                No tienes pagos recurrentes configurados
              </Text>
            )}
          </View>
        )}
      </AnimatedAccordion>
    </View>
  );
}
