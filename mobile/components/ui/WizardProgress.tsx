import { View } from "react-native";

type Props = {
  /** 1-indexed current step */
  step: number;
  /** Total number of steps */
  total: number;
};

/**
 * Horizontal progress bar for step-by-step flows. Filled segments are brass,
 * pending segments are sage-10. Used by the import wizard and onboarding.
 */
export function WizardProgress({ step, total }: Props) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: step }}
      className="flex-row gap-1"
    >
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className={`h-[3px] flex-1 rounded-full ${
            i < step ? "bg-z-brass" : "bg-z-sage-10"
          }`}
        />
      ))}
    </View>
  );
}
