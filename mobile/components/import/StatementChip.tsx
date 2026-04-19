import { View, Text } from "react-native";
import { formatDate } from "@zeta/shared";

type Props = {
  bank: string;
  cardLastFour?: string | null;
  accountNumber?: string | null;
  periodFrom?: string | null;
  periodTo?: string | null;
};

function buildTitle(
  bank: string,
  cardLastFour?: string | null,
  accountNumber?: string | null,
): string {
  const bankLabel = bank.toUpperCase();
  if (cardLastFour) return `${bankLabel} · ••${cardLastFour}`;
  if (accountNumber) return `${bankLabel} · ${accountNumber}`;
  return bankLabel;
}

function formatPeriod(from?: string | null, to?: string | null): string | null {
  if (!from && !to) return null;
  if (from && to) return `${formatDate(from, "d MMM")} – ${formatDate(to, "d MMM yyyy")}`;
  if (from) return `Desde ${formatDate(from, "d MMM yyyy")}`;
  if (to) return `Hasta ${formatDate(to!, "d MMM yyyy")}`;
  return null;
}

export function StatementChip({
  bank,
  cardLastFour,
  accountNumber,
  periodFrom,
  periodTo,
}: Props) {
  const title = buildTitle(bank, cardLastFour, accountNumber);
  const period = formatPeriod(periodFrom, periodTo);

  return (
    <View className="rounded-xl border border-z-brass-25 bg-z-brass-8 px-4 py-2.5">
      <Text className="text-[10px] font-inter-semibold uppercase text-z-sage-dark tracking-[0.18em]">
        {title}
      </Text>
      {period && (
        <Text className="mt-0.5 text-xs font-inter text-z-sage-light">
          {period}
        </Text>
      )}
    </View>
  );
}
