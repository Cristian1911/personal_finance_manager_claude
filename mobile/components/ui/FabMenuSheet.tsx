import { Pressable, Text, View } from "react-native";
import { Plus, Mic, Sparkles, Image as ImageIcon } from "lucide-react-native";
import { COLORS } from "../../lib/constants/colors";
import { PANEL_INSET_CLASS } from "../../lib/constants/styles";
import { MobileSheet } from "./MobileSheet";

export type FabMenuAction =
  | "new-transaction"
  | "voice"
  | "quick-capture"
  | "screenshot";

interface FabMenuSheetProps {
  visible: boolean;
  onClose: () => void;
  onAction: (action: FabMenuAction) => void;
}

export function FabMenuSheet({ visible, onClose, onAction }: FabMenuSheetProps) {
  function handle(action: FabMenuAction) {
    onClose();
    // Defer action so the slide-out finishes before the next screen mounts —
    // otherwise Expo Router navigation races with the closing animation.
    setTimeout(() => onAction(action), 50);
  }

  return (
    <MobileSheet visible={visible} onClose={onClose}>
      <View className="px-4 gap-3">
            <Pressable
              onPress={() => handle("new-transaction")}
              accessibilityRole="button"
              accessibilityLabel="Nueva transacción"
              className="flex-row items-center gap-3 rounded-2xl border border-z-brass-30 bg-z-brass-10 px-4 py-3 active:bg-z-brass-20"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-z-brass">
                <Plus size={20} color={COLORS.ink} strokeWidth={2.5} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-inter-semibold text-foreground">
                  Nueva transacción
                </Text>
                <Text className="text-xs font-inter text-muted-foreground">
                  Gasto, ingreso o transferencia
                </Text>
              </View>
            </Pressable>

            <View className="flex-row gap-3">
              <Pressable
                onPress={() => handle("voice")}
                accessibilityRole="button"
                accessibilityLabel="Captura por voz"
                className={`${PANEL_INSET_CLASS} flex-1 flex-row items-center gap-2.5 px-3 py-3 active:bg-black-10`}
              >
                <View className="h-8 w-8 items-center justify-center rounded-full bg-z-brass-15">
                  <Mic size={16} color={COLORS.brass} strokeWidth={2} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-inter-semibold text-foreground">
                    Captura por voz
                  </Text>
                  <Text className="text-[10px] font-inter text-muted-foreground">
                    Di tu gasto
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => handle("quick-capture")}
                accessibilityRole="button"
                accessibilityLabel="Captura rápida"
                className={`${PANEL_INSET_CLASS} flex-1 flex-row items-center gap-2.5 px-3 py-3 active:bg-black-10`}
              >
                <View className="h-8 w-8 items-center justify-center rounded-full bg-z-brass-15">
                  <Sparkles size={16} color={COLORS.brass} strokeWidth={2} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-inter-semibold text-foreground">
                    Captura rápida
                  </Text>
                  <Text className="text-[10px] font-inter text-muted-foreground">
                    Escribe el gasto
                  </Text>
                </View>
              </Pressable>
            </View>

            <Pressable
              onPress={() => handle("screenshot")}
              accessibilityRole="button"
              accessibilityLabel="Importar pantallazo"
              className={`${PANEL_INSET_CLASS} flex-row items-center gap-2.5 px-4 py-3 active:bg-black-10`}
            >
              <View className="h-8 w-8 items-center justify-center rounded-full bg-z-brass-15">
                <ImageIcon size={16} color={COLORS.brass} strokeWidth={2} />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-inter-semibold text-foreground">
                  Importar pantallazo
                </Text>
                <Text className="text-[10px] font-inter text-muted-foreground">
                  Sube una imagen de tu app bancaria
                </Text>
              </View>
            </Pressable>
      </View>
    </MobileSheet>
  );
}
