import { useEffect, useRef, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useV2Theme } from "../theme/ThemeProvider";
import { COLLAPSE_EASING, useMotionMs } from "./Collapse";

/**
 * A bottom sheet for v2: the page behind dims in place (the scrim only fades)
 * while the sheet alone slides up, and both reverse on close before the modal
 * goes away. Reduced motion: no slide, no fade.
 */
export function Sheet({
  open,
  onClose,
  children,
  style,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** The sheet's own padding, gap and max height (background and corners are set here). */
  style?: StyleProp<ViewStyle>;
}) {
  const t = useV2Theme();
  const duration = useMotionMs(280);
  const [mounted, setMounted] = useState(open);
  const progress = useSharedValue(0);
  // Until measured, a sheet is taken as tall as a phone so it starts fully below.
  const height = useSharedValue(900);
  const openNow = useRef(open);
  openNow.current = open;
  const unmountIfClosed = () => { if (!openNow.current) setMounted(false); };

  useEffect(() => {
    if (open) setMounted(true);
    progress.value = withTiming(open ? 1 : 0, { duration, easing: COLLAPSE_EASING }, (done) => {
      if (done && !open) scheduleOnRN(unmountIfClosed);
    });
  }, [open, progress, duration]);

  const fade = useAnimatedStyle(() => ({ opacity: progress.value }));
  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - progress.value) * height.value }] }));

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.fill, { backgroundColor: t.colors.scrim }, fade]}>
        <Pressable style={styles.fill} onPress={onClose} accessible={false} />
      </Animated.View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.anchor} pointerEvents="box-none">
        <Animated.View
          onLayout={(e) => { height.value = e.nativeEvent.layout.height; }}
          style={[styles.sheet, { backgroundColor: t.colors.card }, style, slide]}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
        >
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  anchor: { flex: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26 },
});
