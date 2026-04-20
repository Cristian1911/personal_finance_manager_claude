import { View, Text } from "react-native";
import { formatCurrency, formatDate, type CurrencyCode } from "@zeta/shared";
import {
  ChipEyebrow,
  ChipDetailHeading,
  type ChipTone,
} from "../../ui/ExpandableChip";
import { PANEL_INSET_CLASS } from "../../../lib/constants/styles";
import type {
  UpcomingItem,
  NextBill,
  NextIncome,
} from "../../../lib/dashboard/useDashboardData";
import type { WidgetRender } from "../WidgetGrid";

/**
 * "vence hoy" / "mañana" / "en N días" — label for how far out an
 * occurrence is. Caller supplies the todayLabel since it varies by
 * direction ("vence hoy" for bills, "llega hoy" for incomes).
 */
export function daysUntilLabel(days: number, todayLabel: string): string {
  if (days === 0) return todayLabel;
  if (days === 1) return "mañana";
  return `en ${days} días`;
}

/**
 * Shared detail panel for "upcoming recurring" chips (bills, incomes).
 * Renders a ranked list with date + optional account + amount, plus a
 * total row at the bottom. Tone drives the amount + total text colors.
 */
export function UpcomingList({
  items,
  tone,
  currency,
  heading,
  emptyText,
}: {
  items: UpcomingItem[];
  tone: ChipTone;
  currency: CurrencyCode;
  heading: string;
  emptyText: string;
}) {
  const total = items.reduce((s, u) => s + u.amount, 0);
  const amountCls =
    tone === "income"
      ? "text-z-income"
      : tone === "debt"
        ? "text-z-debt"
        : tone === "alert"
          ? "text-z-alert"
          : "text-foreground";

  return (
    <View className={`${PANEL_INSET_CLASS} p-3`}>
      <ChipDetailHeading tone={tone}>{heading}</ChipDetailHeading>
      {items.length === 0 ? (
        <Text className="py-3 text-center text-[12px] font-inter text-muted-foreground">
          {emptyText}
        </Text>
      ) : (
        <>
          {items.map((u) => (
            <View
              key={u.id}
              className="flex-row items-center justify-between border-b border-white-6 py-2"
            >
              <View className="min-w-0 flex-1 pr-2">
                <Text
                  className="text-[12px] font-inter-medium text-foreground"
                  numberOfLines={1}
                >
                  {u.name}
                </Text>
                <Text
                  className="text-[10px] font-inter text-muted-foreground"
                  numberOfLines={1}
                >
                  {formatDate(u.date, "dd MMM yyyy")}
                  {u.accountName ? ` · ${u.accountName}` : ""}
                </Text>
              </View>
              <Text
                className={`text-[13px] font-inter-semibold tabular-nums ${amountCls}`}
              >
                {formatCurrency(u.amount, currency)}
              </Text>
            </View>
          ))}
          <View className="mt-2 flex-row justify-between pt-2">
            <Text className="text-[11px] font-inter text-muted-foreground">
              Total
            </Text>
            <Text
              className={`text-[12px] font-inter-bold tabular-nums ${amountCls}`}
            >
              {formatCurrency(total, currency)}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

/**
 * Shared chip+detail renderer for "next recurring occurrence" widgets.
 * Both Próximo pago (debt tone) and Próximo ingreso (income tone) have
 * identical structure; only the tone, copy, and today-label differ.
 */
export function renderUpcomingRecurringWidget({
  item,
  upcoming,
  currency,
  tone,
  eyebrow,
  emptyLabel,
  todayLabel,
  detailHeading,
  detailEmpty,
  accessibilityLabel,
}: {
  item: NextBill | NextIncome;
  upcoming: UpcomingItem[];
  currency: CurrencyCode;
  tone: ChipTone;
  eyebrow: string;
  emptyLabel: string;
  todayLabel: string;
  detailHeading: string;
  detailEmpty: string;
  accessibilityLabel: string;
}): WidgetRender {
  const amountCls =
    tone === "income"
      ? "text-z-income"
      : tone === "debt"
        ? "text-z-debt"
        : "text-foreground";

  return {
    tone,
    accessibilityLabel,
    chip: (
      <View>
        <ChipEyebrow tone={tone}>{eyebrow}</ChipEyebrow>
        {item ? (
          <>
            <Text
              className={`mt-2 text-[24px] font-inter-bold tabular-nums ${amountCls}`}
              numberOfLines={1}
            >
              {formatCurrency(item.amount, currency)}
            </Text>
            <Text
              className="mt-1 text-[11px] font-inter text-foreground"
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <Text className="text-[10px] font-inter text-muted-foreground">
              {daysUntilLabel(item.daysUntil, todayLabel)}
            </Text>
          </>
        ) : (
          <>
            <Text className="mt-2 text-[24px] font-inter-bold text-z-sage-dark">
              —
            </Text>
            <Text className="mt-1 text-[11px] font-inter text-muted-foreground">
              {emptyLabel}
            </Text>
          </>
        )}
      </View>
    ),
    detail: () => (
      <UpcomingList
        items={upcoming}
        tone={tone}
        currency={currency}
        heading={detailHeading}
        emptyText={detailEmpty}
      />
    ),
  };
}
