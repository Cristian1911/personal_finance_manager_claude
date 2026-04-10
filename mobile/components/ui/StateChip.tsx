import { Text } from "react-native";

const variants = {
  sage: "bg-z-income-12 border-z-income-25 text-z-income",
  brass: "bg-z-brass-12 border-z-brass-25 text-z-brass",
  warn: "bg-z-alert-12 border-z-alert-25 text-z-alert",
  danger: "bg-z-debt-12 border-z-debt-25 text-z-debt",
} as const;

interface StateChipProps {
  label: string;
  variant: keyof typeof variants;
  className?: string;
}

export function StateChip({ label, variant, className }: StateChipProps) {
  return (
    <Text
      className={`rounded-full border px-2.5 py-0.5 text-[9px] font-inter-bold uppercase ${variants[variant]} ${className ?? ""}`}
    >
      {label}
    </Text>
  );
}
