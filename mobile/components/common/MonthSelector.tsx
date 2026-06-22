import { Pressable, Text, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { formatMonthLabel } from "@zeta/shared";
import { COLORS } from "../../lib/constants/colors";

function parseMonth(month: string): Date {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(year, monthIndex - 1, 1, 12, 0, 0);
}

function toMonthString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function shiftMonth(month: string, delta: number): string {
  const date = parseMonth(month);
  date.setMonth(date.getMonth() + delta);
  return toMonthString(date);
}

export function MonthSelector({
  month,
  onChange,
}: {
  month: string;
  onChange: (month: string) => void;
}) {
  const labelDate = parseMonth(month);
  const currentMonth = toMonthString(new Date());
  const isCurrentMonth = month === currentMonth;

  return (
    <View className="flex-row items-center justify-between rounded-xl bg-z-surface-2 border border-white-6 px-3 py-2">
      <Pressable
        onPress={() => onChange(shiftMonth(month, -1))}
        className="h-8 w-8 items-center justify-center rounded-full bg-black-10"
      >
        <ChevronLeft size={16} color={COLORS.sageDark} />
      </Pressable>

      <Text className="text-foreground font-inter-semibold text-sm capitalize">
        {formatMonthLabel(labelDate)}
      </Text>

      <View className="flex-row items-center gap-2">
        {!isCurrentMonth && (
          <Pressable
            onPress={() => onChange(currentMonth)}
            className="rounded-full border border-z-brass-20 bg-z-brass-8 px-2.5 py-1"
          >
            <Text className="text-z-brass font-inter-medium text-xs">Hoy</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => onChange(shiftMonth(month, 1))}
          className="h-8 w-8 items-center justify-center rounded-full bg-black-10"
        >
          <ChevronRight size={16} color={COLORS.sageDark} />
        </Pressable>
      </View>
    </View>
  );
}
