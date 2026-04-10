import { View } from "react-native";
import type { ReactNode } from "react";
import { COLORS } from "../../lib/constants/colors";

/**
 * Hero card with dark gradient background.
 * On web this uses CSS radial-gradient + linear-gradient.
 * On RN we approximate with a dark surface + subtle top-left tint.
 *
 * TODO: Replace with expo-linear-gradient once the dep is added.
 * For now, uses a solid dark background that matches the visual intent.
 */
interface GradientCardProps {
  children: ReactNode;
  className?: string;
}

export function GradientCard({ children, className }: GradientCardProps) {
  return (
    <View
      className={`rounded-2xl border border-white-6 bg-z-surface-2 p-5 ${className ?? ""}`}
      style={{
        // Subtle gradient approximation via shadow
        shadowColor: COLORS.oliveDeep,
        shadowOffset: { width: -20, height: -10 },
        shadowOpacity: 0.15,
        shadowRadius: 40,
      }}
    >
      {children}
    </View>
  );
}
