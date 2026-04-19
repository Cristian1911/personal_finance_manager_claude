import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { WidgetFrame } from "./WidgetFrame";
import { SECTION_EYEBROW_CLASS } from "../../../lib/constants/styles";
import { isDebtAccountType } from "../../../lib/constants/accounts";
import type { AccountRow } from "../../../lib/repositories/accounts";

interface AccountsWidgetProps {
  accounts: AccountRow[];
  currency: CurrencyCode;
  editing?: boolean;
  onRemove?: () => void;
}

export function AccountsWidget({
  accounts,
  currency,
  editing,
  onRemove,
}: AccountsWidgetProps) {
  const router = useRouter();

  const top = [...accounts]
    .filter((a) => a.is_active)
    .sort((a, b) => Math.abs(b.current_balance) - Math.abs(a.current_balance))
    .slice(0, 3);

  return (
    <WidgetFrame
      editing={editing}
      onRemove={onRemove}
      onPress={() => router.push("/accounts-list" as any)}
      accessibilityLabel="Cuentas"
    >
      <Text className={SECTION_EYEBROW_CLASS}>Cuentas</Text>
      <View className="mt-2 gap-1">
        {top.length === 0 ? (
          <Text className="text-[11px] font-inter text-muted-foreground">
            Sin cuentas
          </Text>
        ) : (
          top.map((a) => {
            const isDebt = isDebtAccountType(a.account_type);
            const sign = isDebt ? "-" : "";
            return (
              <View key={a.id} className="flex-row items-center justify-between">
                <Text
                  className="flex-1 text-[12px] font-inter text-foreground"
                  numberOfLines={1}
                >
                  {a.name}
                </Text>
                <Text
                  className={`text-[12px] font-inter-semibold tabular-nums ${
                    isDebt ? "text-z-expense" : "text-foreground"
                  }`}
                >
                  {sign}
                  {formatCurrency(a.current_balance, currency)}
                </Text>
              </View>
            );
          })
        )}
      </View>
    </WidgetFrame>
  );
}
