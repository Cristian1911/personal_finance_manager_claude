import type { ComponentProps, ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";

type ScrollProps = ComponentProps<typeof ScrollView> & {
  avoidKeyboard?: boolean;
  bottomOffset?: number;
};

export function AppKeyboardProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function AppKeyboardAwareScrollView({
  avoidKeyboard = true,
  bottomOffset = 20,
  children,
  keyboardShouldPersistTaps = "handled",
  keyboardDismissMode = Platform.OS === "ios" ? "interactive" : "on-drag",
  style,
  ...props
}: ScrollProps) {
  const scrollView = (
    <ScrollView
      {...props}
      style={avoidKeyboard ? styles.scroll : style}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      keyboardDismissMode={keyboardDismissMode}
    >
      {children}
    </ScrollView>
  );

  if (!avoidKeyboard) {
    return scrollView;
  }

  return (
    <KeyboardAvoidingView
      style={style}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={bottomOffset}
    >
      {scrollView}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
});
