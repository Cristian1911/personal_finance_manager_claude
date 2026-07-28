import { ScrollView, Pressable, Text } from "react-native";

export type RangeValue = 0 | 7 | 14 | 30 | 90 | 180 | 365;

const RANGES: { label: string; value: RangeValue }[] = [
  { label: "1S", value: 7 },
  { label: "2S", value: 14 },
  { label: "1M", value: 30 },
  { label: "3M", value: 90 },
  { label: "6M", value: 180 },
  { label: "1A", value: 365 },
  { label: "Todo", value: 0 },
];

type Props = {
  value: RangeValue;
  onChange: (v: RangeValue) => void;
};

export function RangePills({ value, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Pill row: never grow vertically (see PlanificadorRoot).
      style={{ flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={{ gap: 4, paddingHorizontal: 2 }}
    >
      {RANGES.map((r) => {
        const active = r.value === value;
        return (
          <Pressable
            key={r.value}
            onPress={() => onChange(r.value)}
            className={`rounded-full px-2.5 py-0.5 ${
              active ? "bg-z-brass" : "bg-white-6"
            }`}
          >
            <Text
              className={`font-inter-medium text-xs ${
                active ? "text-z-ink" : "text-z-sage-dark"
              }`}
            >
              {r.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
