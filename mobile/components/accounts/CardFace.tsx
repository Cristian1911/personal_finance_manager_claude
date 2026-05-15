import { View, Text, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import type { AccountRow } from "../../lib/repositories/accounts";

const INSTITUTION_GRADIENTS: Record<string, [string, string, string]> = {
  bancolombia: ["#2d3a2a", "#3f4632", "#8b7a3a"],
  nequi: ["#2a1040", "#45186e", "#c0408a"],
  davivienda: ["#3a1010", "#6e1818", "#c42020"],
  nu: ["#3a1a60", "#6b30a0", "#a060d0"],
  "banco de bogota": ["#0a1a3a", "#183060", "#2850a0"],
  falabella: ["#1a2a1a", "#2a4a2a", "#4a8a3a"],
  lulo: ["#1a0a2a", "#3a1a5a", "#6a30a0"],
};

const FALLBACK_GRADIENT: [string, string, string] = ["#1a1a1a", "#252525", "#333333"];

const TYPE_LABELS: Record<string, string> = {
  CREDIT_CARD: "CRÉDITO",
  SAVINGS: "AHORROS",
  CHECKING: "DÉBITO",
  CASH: "EFECTIVO",
  INVESTMENT: "INVERSIÓN",
  LOAN: "PRÉSTAMO",
  OTHER: "CUENTA",
};

type Props = {
  account: AccountRow;
};

export function CardFace({ account }: Props) {
  const key = (account.institution_name ?? "").toLowerCase().trim();
  const [c1, c2, c3] = INSTITUTION_GRADIENTS[key] ?? FALLBACK_GRADIENT;
  const mask = account.debit_card_mask;
  const typeLabel = TYPE_LABELS[account.account_type ?? ""] ?? "CUENTA";
  const cc = (account.currency_code as CurrencyCode) ?? "COP";

  return (
    <View
      style={{ aspectRatio: 85.6 / 53.98, width: "100%" }}
      className="rounded-xl overflow-hidden"
    >
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="cardGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c1} />
            <Stop offset="0.5" stopColor={c2} />
            <Stop offset="1" stopColor={c3} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#cardGrad)" />
      </Svg>
      <View className="flex-1 p-4 justify-between">
        <View className="flex-row items-start justify-between">
          <Text
            style={{ color: "rgba(255,255,255,0.7)" }}
            className="font-inter-medium text-xs uppercase"
            numberOfLines={1}
          >
            {account.institution_name ?? ""}
          </Text>
          <Text
            style={{ color: "rgba(255,255,255,0.5)", letterSpacing: 1.5 }}
            className="font-inter-semibold text-[10px] uppercase"
          >
            {typeLabel}
          </Text>
        </View>
        <View className="flex-1 justify-center">
          <Text
            style={{ color: "#FFFFFF" }}
            className="font-inter-bold text-xl tabular-nums"
          >
            {formatCurrency(account.current_balance ?? 0, cc)}
          </Text>
        </View>
        <View className="flex-row items-end justify-between">
          <Text
            style={{ color: "rgba(255,255,255,0.6)", letterSpacing: 2 }}
            className="font-inter-medium text-sm"
          >
            {mask ? `•••• ${mask}` : "••••"}
          </Text>
          <Text
            style={{ color: "rgba(255,255,255,0.4)" }}
            className="font-inter-medium text-xs"
          >
            {account.currency_code}
          </Text>
        </View>
      </View>
    </View>
  );
}
