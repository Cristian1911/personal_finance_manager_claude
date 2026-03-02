import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import {
  KeyboardAvoidingView,
  KeyboardAwareScrollView,
} from "react-native-keyboard-controller";

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
  return (
    <KeyboardAvoidingView className="flex-1 bg-gray-100" behavior="padding">
      <View className="flex-row items-center justify-between border-b border-gray-100 bg-white px-4 pb-2 pt-4">
        <Pressable
          onPress={onBack}
          className="h-8 w-8 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
        >
          <ArrowLeft size={18} color="#6B7280" />
        </Pressable>
        <Text className="text-base font-inter-bold text-gray-900">{title}</Text>
        <View className="w-8" />
      </View>

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        bottomOffset={20}
      >
        {children}
      </KeyboardAwareScrollView>

      {footer ? (
        <View className="border-t border-gray-200 bg-white p-4">{footer}</View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
