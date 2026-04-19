import { View, Pressable } from "react-native";
import { X } from "lucide-react-native";
import type { ReactNode } from "react";
import { COLORS } from "../../../lib/constants/colors";
import { PANEL_SURFACE_SUBTLE_CLASS } from "../../../lib/constants/styles";

interface WidgetFrameProps {
  children: ReactNode;
  onPress?: () => void;
  editing?: boolean;
  onRemove?: () => void;
  className?: string;
  minHeight?: number;
  accessibilityLabel?: string;
}

export function WidgetFrame({
  children,
  onPress,
  editing = false,
  onRemove,
  className = "",
  minHeight = 88,
  accessibilityLabel,
}: WidgetFrameProps) {
  const Container: any = onPress && !editing ? Pressable : View;
  return (
    <View className="relative">
      <Container
        onPress={onPress && !editing ? onPress : undefined}
        accessibilityLabel={accessibilityLabel}
        className={`${PANEL_SURFACE_SUBTLE_CLASS} p-3 ${className}`}
        style={{ minHeight }}
      >
        {children}
      </Container>
      {editing && onRemove && (
        <Pressable
          onPress={onRemove}
          accessibilityLabel="Quitar widget"
          className="absolute -right-1.5 -top-1.5 h-6 w-6 items-center justify-center rounded-full border border-z-debt-30 bg-z-surface-2"
        >
          <X size={12} color={COLORS.debt} />
        </Pressable>
      )}
    </View>
  );
}
