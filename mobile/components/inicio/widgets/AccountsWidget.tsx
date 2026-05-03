import { View, Text } from "react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import {
  ChipEyebrow,
  ChipDetailHeading,
  type ChipTone,
} from "../../ui/ExpandableChip";
import { PANEL_INSET_CLASS } from "../../../lib/constants/styles";
import { isDebtAccountType } from "../../../lib/constants/accounts";
import type { AccountRow } from "../../../lib/repositories/accounts";

export interface AccountsWidgetData {
  accounts: AccountRow[];
  currency: CurrencyCode;
}

function shortAccountName(a: AccountRow): string {
  const name = a.name.trim();
  const inst = a.institution_name?.trim();
  if (inst && name.toLowerCase().startsWith(inst.toLowerCase() + " ")) {
    return name.slice(inst.length).trim();
  }
  const mask = a.debit_card_mask;
  if (mask) {
    const escaped = mask.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\s*·?\\s*\\*{2,}${escaped}\\s*$`);
    const stripped = name.replace(re, "").trim();
    if (stripped.length > 0) return stripped;
  }
  return name;
}

function shortAmount(amount: number, currency: CurrencyCode): string {
  const abs = Math.abs(amount);
  const sym = currency === "COP" ? "$" : `${currency} `;
  if (abs >= 1_000_000) {
    return `${sym}${(abs / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  }
  if (abs >= 1_000) {
    return `${sym}${Math.round(abs / 1_000)}k`;
  }
  return formatCurrency(abs, currency);
}

export function renderAccountsWidget({ accounts, currency }: AccountsWidgetData) {
  const tone: ChipTone = "brass";
  const active = accounts.filter((a) => a.is_active);
  const liquid = active
    .filter((a) => !isDebtAccountType(a.account_type))
    .reduce((s, a) => s + a.current_balance, 0);
  const debt = active
    .filter((a) => isDebtAccountType(a.account_type))
    .reduce((s, a) => s + a.current_balance, 0);
  const net = liquid - debt;

  const sorted = [...active].sort(
    (a, b) => Math.abs(b.current_balance) - Math.abs(a.current_balance)
  );
  const preview = sorted.slice(0, 3);

  return {
    tone,
    accessibilityLabel: "Cuentas",
    chip: (
      <View className="flex-1 self-stretch">
        <ChipEyebrow tone={tone}>Cuentas</ChipEyebrow>
        {preview.length === 0 ? (
          <Text className="mt-2 text-[11px] font-inter text-muted-foreground">
            Sin cuentas
          </Text>
        ) : (
          <View className="mt-2 gap-1">
            {preview.map((a) => {
              const isDebt = isDebtAccountType(a.account_type);
              return (
                <View
                  key={a.id}
                  className="flex-row items-center justify-between gap-2"
                >
                  <Text
                    className="min-w-0 flex-1 text-[12px] font-inter text-foreground"
                    numberOfLines={1}
                  >
                    {shortAccountName(a)}
                  </Text>
                  <Text
                    className={`text-[12px] font-inter-semibold tabular-nums ${
                      isDebt ? "text-z-debt" : "text-foreground"
                    }`}
                  >
                    {isDebt ? "-" : ""}
                    {shortAmount(Math.abs(a.current_balance), currency)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    ),
    detail: () => (
      <View className={`${PANEL_INSET_CLASS} p-3`}>
        <ChipDetailHeading tone={tone}>Todas las cuentas</ChipDetailHeading>
        {sorted.length === 0 ? (
          <Text className="py-3 text-center text-[12px] font-inter text-muted-foreground">
            Sin cuentas
          </Text>
        ) : (
          <>
            {sorted.map((a) => {
              const isDebt = isDebtAccountType(a.account_type);
              return (
                <View
                  key={a.id}
                  className="flex-row items-center justify-between border-b border-white-6 py-2"
                >
                  <View className="min-w-0 flex-1 pr-2">
                    <Text
                      className="text-[12px] font-inter-medium text-foreground"
                      numberOfLines={1}
                    >
                      {a.name}
                    </Text>
                    <Text
                      className="text-[10px] font-inter text-muted-foreground"
                      numberOfLines={1}
                    >
                      {isDebt ? "Deuda" : "Líquido"}
                    </Text>
                  </View>
                  <Text
                    className={`text-[13px] font-inter-semibold tabular-nums ${
                      isDebt ? "text-z-debt" : "text-foreground"
                    }`}
                  >
                    {isDebt ? "-" : ""}
                    {formatCurrency(a.current_balance, currency)}
                  </Text>
                </View>
              );
            })}
            <View className="mt-2 flex-row justify-between pt-2">
              <Text className="text-[11px] font-inter text-muted-foreground">
                Neto
              </Text>
              <Text className="text-[12px] font-inter-bold tabular-nums text-z-brass">
                {formatCurrency(net, currency)}
              </Text>
            </View>
          </>
        )}
      </View>
    ),
  };
}
