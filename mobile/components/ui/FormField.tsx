import { Pressable, Text, View } from "react-native";

const EYEBROW_CLASS =
  "text-[10px] font-inter-semibold uppercase tracking-[0.18em] text-z-sage-dark";

/** Eyebrow-label + child wrapper. The dominant label pattern across forms. */
export function FieldGroup({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <View className={`gap-1.5 ${className}`}>
      <Text className={EYEBROW_CLASS}>{label}</Text>
      {children}
    </View>
  );
}

/**
 * Radio-pill row (segmented control). Equal-width pills, brass-tinted when
 * selected. Used by enrich drawer + puedo-pagar form.
 */
export function SegmentedRow<T extends string>({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (next: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
}) {
  return (
    <View className="flex-row gap-2">
      {options.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={opt.label}
            className={`flex-1 items-center rounded-xl border py-2.5 ${
              isSelected
                ? "border-z-brass bg-z-brass-12"
                : "border-white-6 bg-z-surface-2"
            }`}
          >
            <Text
              className={`font-inter-semibold text-xs ${
                isSelected ? "text-z-white" : "text-z-sage-light"
              }`}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
