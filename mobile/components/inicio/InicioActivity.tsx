import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react-native";
import { useRouter } from "expo-router";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { COLORS } from "../../lib/constants/colors";
import { AnimatedAccordion } from "../ui/AnimatedAccordion";
import { PANEL_INSET_CLASS } from "../../lib/constants/styles";

export interface RecentTransaction {
  id: string;
  description: string;
  amount: number;
  currency_code: string;
  direction: "INFLOW" | "OUTFLOW";
  account_name: string;
  account_color: string | null;
  category_name_es: string | null;
  category_icon: string | null;
}

interface InicioActivityProps {
  transactions: RecentTransaction[];
}

export function InicioActivity({ transactions }: InicioActivityProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const router = useRouter();

  if (transactions.length === 0) return null;

  const visible = transactions.slice(0, 5);

  return (
    <View>
      <Text className="mb-1.5 text-[9px] font-inter-bold uppercase tracking-[4px] text-z-sage-dark">
        Reciente
      </Text>

      {visible.map((tx) => {
        const isOpen = expandedId === tx.id;
        const isInflow = tx.direction === "INFLOW";

        return (
          <View key={tx.id}>
            <Pressable
              onPress={() => setExpandedId(isOpen ? null : tx.id)}
              className={`flex-row gap-2 px-1 py-2 ${isOpen ? "border-l-2 border-l-z-brass pl-2" : ""}`}
            >
              {/* Direction icon */}
              <View
                className={`mt-0.5 h-[22px] w-[22px] items-center justify-center rounded-md ${isInflow ? "bg-green-500-10" : "bg-z-expense-12"}`}
              >
                {isInflow ? (
                  <ArrowDownLeft size={12} color={COLORS.income} />
                ) : (
                  <ArrowUpRight size={12} color={COLORS.expense} />
                )}
              </View>

              {/* Description + meta */}
              <View className="min-w-0 flex-1">
                <Text className="text-xs font-inter-medium text-foreground" numberOfLines={1}>
                  {tx.description}
                </Text>
                <View className="mt-0.5 flex-row items-center gap-1">
                  <View
                    className="h-[5px] w-[5px] rounded-full"
                    style={{ backgroundColor: tx.account_color ?? COLORS.sageDark }}
                  />
                  <Text className="text-[10px] font-inter text-muted-foreground" numberOfLines={1}>
                    {tx.account_name}
                  </Text>
                  <Text className="text-[10px] text-white-15">·</Text>
                  <Text className={`text-[10px] font-inter ${tx.category_name_es ? "text-muted-foreground" : "text-z-brass"}`} numberOfLines={1}>
                    {tx.category_name_es ?? "Sin cat."}
                  </Text>
                </View>
              </View>

              {/* Amount */}
              <Text className={`text-xs font-inter-medium ${isInflow ? "text-z-income" : "text-foreground"}`}>
                {isInflow ? "+" : "-"}
                {formatCurrency(tx.amount, tx.currency_code as CurrencyCode)}
              </Text>
            </Pressable>

            {/* Inline expand */}
            <AnimatedAccordion expanded={isOpen} estimatedHeight={60}>
              <View className={`my-1.5 ${PANEL_INSET_CLASS} border-z-brass-15 bg-black-20 p-2.5 flex-row items-center justify-between`}>
                <Text className="text-[11px] font-inter text-muted-foreground">
                  {isInflow ? "Ingreso" : "Gasto"} · {formatCurrency(tx.amount, tx.currency_code as CurrencyCode)}
                </Text>
                <Pressable onPress={() => router.push(`/transaction/${tx.id}` as any)}>
                  <Text className="text-[11px] font-inter-semibold text-z-brass">
                    Ver detalle
                  </Text>
                </Pressable>
              </View>
            </AnimatedAccordion>
          </View>
        );
      })}

      <Pressable onPress={() => router.push("/(tabs)/transactions")}>
        <Text className="mt-2 text-[11px] font-inter-semibold text-z-brass">
          Ver todos →
        </Text>
      </Pressable>
    </View>
  );
}
