import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { COLORS } from "../../lib/constants/colors";

// ─── Main tab variant (Inicio, Movimientos, Plan, Deudas) ──────────────────

interface MainHeaderProps {
  variant: "main";
  title: string;
  subtitle?: string;
  action?: ReactNode;
  right?: ReactNode;
}

// ─── Subpage variant (drill-down pages) ─────────────────────────────────────

interface SubHeaderProps {
  variant: "sub";
  title: string;
  action?: ReactNode;
  right?: ReactNode;
}

type MobileHeaderProps = MainHeaderProps | SubHeaderProps;

export function MobileHeader(props: MobileHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  if (props.variant === "sub") {
    return (
      <View
        className="border-b border-white-6 bg-background-92 px-4"
        style={{ paddingTop: insets.top }}
      >
        <View className="h-12 flex-row items-center justify-between gap-3">
          <View className="flex-row items-center gap-2 flex-shrink min-w-0">
            <Pressable
              onPress={() => router.back()}
              className="h-8 w-8 items-center justify-center rounded-full"
              accessibilityLabel="Volver"
            >
              <ArrowLeft size={16} color={COLORS.sageLight} />
            </Pressable>
            <Text
              className="text-[15px] font-inter-semibold text-foreground"
              numberOfLines={1}
            >
              {props.title}
            </Text>
          </View>
          <View className="flex-row items-center gap-2 flex-shrink-0">
            {props.action}
            {props.right}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      className="border-b border-white-6 bg-background-92 px-4"
      style={{ paddingTop: insets.top }}
    >
      <View className="h-12 flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-shrink">
          <Text
            className="text-[15px] font-inter-bold text-foreground"
            numberOfLines={1}
          >
            {props.title}
          </Text>
          {props.subtitle && (
            <Text
              className="text-[11px] font-inter text-muted-foreground"
              numberOfLines={1}
            >
              {props.subtitle}
            </Text>
          )}
        </View>
        <View className="flex-row items-center gap-2 flex-shrink-0">
          {props.action}
          {props.right}
        </View>
      </View>
    </View>
  );
}
