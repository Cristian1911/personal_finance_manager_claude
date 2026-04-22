import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ArrowRight, Lightbulb } from "lucide-react-native";
import { ChipEyebrow } from "../../ui/ExpandableChip";
import {
  BRASS_BUTTON_CLASS,
  PANEL_INSET_CLASS,
} from "../../../lib/constants/styles";
import { COLORS } from "../../../lib/constants/colors";
import type { WidgetRender } from "../WidgetGrid";

export function renderPuedoComprarloWidget(): WidgetRender {
  return {
    tone: "brass",
    accessibilityLabel: "¿Puedo comprarlo? — evaluar una compra",
    chip: (
      <View className="items-center gap-1.5">
        <ChipEyebrow tone="brass">¿Comprarlo?</ChipEyebrow>
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-z-brass-12">
          <Lightbulb size={20} color={COLORS.brass} />
        </View>
        <Text className="text-[10px] font-inter text-muted-foreground">
          Evaluar
        </Text>
      </View>
    ),
    detail: () => <PuedoComprarloDetail />,
    estimatedHeight: 240,
  };
}

function PuedoComprarloDetail() {
  const router = useRouter();
  return (
    <View className={`${PANEL_INSET_CLASS} p-3 gap-3`}>
      <View className="gap-1">
        <Text className="text-sm font-inter-semibold text-foreground">
          Decidí sin culpa
        </Text>
        <Text className="text-xs leading-relaxed font-inter text-muted-foreground">
          Cuéntale a Zeta qué quieres comprar y cuánto cuesta. Revisamos tu
          liquidez, pagos próximos y presupuesto para darte una respuesta
          honesta: sí, espera o no recomendado.
        </Text>
      </View>
      <Pressable
        onPress={() => router.push("/purchase-decision")}
        className={`${BRASS_BUTTON_CLASS} flex-row items-center justify-center gap-2 rounded-xl px-4 py-2.5`}
      >
        <Text className="text-sm font-inter-semibold text-z-ink">
          Abrir analizador
        </Text>
        <ArrowRight size={16} color={COLORS.ink} />
      </Pressable>
    </View>
  );
}
