import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppKeyboardAwareScrollView } from "./AppKeyboardAwareScrollView";
import { MOBILE_TAB_BAR_CLEARANCE } from "../../lib/constants/styles";
import { COLORS } from "../../lib/constants/colors";

export function KeyboardScreen({
  title,
  onBack,
  children,
  footer,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior="padding"
    >
      <View
        className="flex-row items-center justify-between border-b border-white-6 bg-z-surface-2-55 px-4 pb-2"
        style={{ paddingTop: insets.top }}
      >
        <Pressable
          onPress={onBack}
          className="h-8 w-8 items-center justify-center rounded-full bg-black-10 active:bg-z-surface-2/10"
        >
          <ArrowLeft size={18} color={COLORS.sageDark} />
        </Pressable>
        <Text className="text-base font-inter-bold text-foreground">{title}</Text>
        <View className="w-8" />
      </View>

      <AppKeyboardAwareScrollView
        avoidKeyboard={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: MOBILE_TAB_BAR_CLEARANCE }}
        bottomOffset={20}
      >
        {children}
      </AppKeyboardAwareScrollView>

      {footer ? (
        <View className="border-t border-white-6 bg-z-surface-2-55 p-4">{footer}</View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
