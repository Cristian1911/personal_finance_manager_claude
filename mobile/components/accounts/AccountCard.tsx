import { View, Text, Pressable } from "react-native";
import { ACCOUNT_TYPES } from "../../lib/constants/accounts";
import { formatCurrency, type CurrencyCode } from "@venti5/shared";
import type { AccountRow } from "../../lib/repositories/accounts";

type Props = {
  account: AccountRow;
  onPress: () => void;
};

const DEBT_TYPES = new Set(["CREDIT_CARD", "LOAN"]);

export function AccountCard({ account, onPress }: Props) {
  const typeDef = ACCOUNT_TYPES.find((t) => t.value === account.account_type);
  const Icon = typeDef?.icon;
  const shortLabel = typeDef?.shortLabel ?? account.account_type;
  const color = account.color ?? "#6B7280";
  const isDebt = DEBT_TYPES.has(account.account_type);

  return (
    <Pressable
      className="bg-white rounded-xl p-4 flex-row items-center active:bg-gray-50"
      onPress={onPress}
    >
      {/* Icon circle */}
      <View
        className="w-11 h-11 rounded-full items-center justify-center mr-4 flex-shrink-0"
        style={{ backgroundColor: color + "20" }}
      >
        {Icon && <Icon size={20} color={color} />}
      </View>

      {/* Name + institution */}
      <View className="flex-1 min-w-0">
        <Text
          className="text-gray-900 font-inter-semibold text-sm"
          numberOfLines={1}
        >
          {account.name}
        </Text>
        <View className="flex-row items-center mt-0.5 gap-2">
          {account.institution_name && (
            <Text
              className="text-gray-400 font-inter text-xs"
              numberOfLines={1}
            >
              {account.institution_name}
            </Text>
          )}
          <View className="bg-gray-100 rounded px-1.5 py-0.5">
            <Text className="text-gray-500 font-inter text-xs">{shortLabel}</Text>
          </View>
        </View>
      </View>

      {/* Balance */}
      <View className="ml-3 items-end flex-shrink-0">
        <Text
          className={`font-inter-semibold text-sm ${
            isDebt ? "text-red-500" : "text-gray-900"
          }`}
        >
          {formatCurrency(
            account.current_balance,
            (account.currency_code as CurrencyCode) ?? "COP"
          )}
        </Text>
        {account.account_type === "CREDIT_CARD" && account.credit_limit && (
          <Text className="text-gray-400 font-inter text-xs mt-0.5">
            límite {formatCurrency(account.credit_limit, (account.currency_code as CurrencyCode) ?? "COP")}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
