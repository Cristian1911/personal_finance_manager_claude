import { Pressable, Text, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { formatMonthLabel } from "@venti5/shared";

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
    <View className="flex-row items-center justify-between rounded-xl bg-white px-3 py-2 shadow-sm">
      <Pressable
        onPress={() => onChange(shiftMonth(month, -1))}
        className="h-8 w-8 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
      >
        <ChevronLeft size={16} color="#6B7280" />
      </Pressable>

      <Text className="text-gray-700 font-inter-semibold text-sm capitalize">
        {formatMonthLabel(labelDate)}
      </Text>

      <View className="flex-row items-center gap-2">
        {!isCurrentMonth && (
          <Pressable
            onPress={() => onChange(currentMonth)}
            className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 active:bg-emerald-100"
          >
            <Text className="text-emerald-700 font-inter-medium text-xs">Hoy</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => onChange(shiftMonth(month, 1))}
          className="h-8 w-8 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
        >
          <ChevronRight size={16} color="#6B7280" />
        </Pressable>
      </View>
    </View>
  );
}

