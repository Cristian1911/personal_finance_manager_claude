import type { ComponentProps, ReactNode } from "react";
import { ScrollView, StyleSheet } from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardProvider,
} from "react-native-keyboard-controller";

type ScrollProps = ComponentProps<typeof ScrollView> & {
  avoidKeyboard?: boolean;
  bottomOffset?: number;
};

export function AppKeyboardProvider({ children }: { children: ReactNode }) {
  return <KeyboardProvider>{children}</KeyboardProvider>;
}

export function AppKeyboardAwareScrollView({
  avoidKeyboard = true,
  bottomOffset = 20,
  children,
  keyboardShouldPersistTaps = "handled",
  keyboardDismissMode = "interactive",
  style,
  ...props
}: ScrollProps) {
  if (!avoidKeyboard) {
    return (
      <ScrollView
        {...props}
        style={style}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode={keyboardDismissMode}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <KeyboardAwareScrollView
      {...props}
      style={style ?? styles.scroll}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      keyboardDismissMode={keyboardDismissMode}
      bottomOffset={bottomOffset}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
});
