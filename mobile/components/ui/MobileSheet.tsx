import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const MODAL_SCRIM_COLOR = "rgba(0,0,0,0.5)";

interface MobileSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Cap the sheet height. Default 82%. */
  maxHeightClass?: string;
  /** Hide the drag-handle pill. */
  hideHandle?: boolean;
}

/**
 * Bottom-sheet Modal scaffolding shared across FabMenuSheet,
 * CategoryZonePickerSheet, AccountPickerModal. Enforces safe-area
 * bottom padding, scrim backdrop, and drag handle.
 */
export function MobileSheet({
  visible,
  onClose,
  children,
  maxHeightClass = "max-h-[82%]",
  hideHandle = false,
}: MobileSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Keep the sheet (+ its inputs) above the keyboard. RN's KeyboardAvoidingView
          is used here on purpose — it's modal-safe; keyboard-controller's variant
          needs a nested provider inside the Modal window (future UI-thread upgrade). */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
      <Pressable
        onPress={onClose}
        style={{ backgroundColor: MODAL_SCRIM_COLOR }}
        className="flex-1 justify-end"
        accessibilityLabel="Cerrar"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className={`${maxHeightClass} rounded-t-2xl border border-white-6 bg-background`}
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          {!hideHandle && (
            <View className="mx-auto mt-3 mb-3 h-1 w-10 rounded-full bg-z-surface-2-10" />
          )}
          {children}
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
