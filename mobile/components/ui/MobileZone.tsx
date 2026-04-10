import { View, Text } from "react-native";
import type { ReactNode } from "react";

interface MobileZoneProps {
  eyebrow?: string;
  heading?: string;
  children: ReactNode;
  className?: string;
}

export function MobileZone({
  eyebrow,
  heading,
  children,
  className,
}: MobileZoneProps) {
  return (
    <View className={`gap-2 ${className ?? ""}`}>
      {eyebrow && (
        <Text className="text-[9px] font-inter-bold uppercase tracking-[4px] text-z-sage-dark">
          {eyebrow}
        </Text>
      )}
      {heading && (
        <Text className="text-[15px] font-inter-semibold text-foreground">
          {heading}
        </Text>
      )}
      {children}
    </View>
  );
}
