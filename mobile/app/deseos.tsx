import { View, Text, ScrollView } from "react-native";
import { Heart } from "lucide-react-native";
import { MobileHeader } from "../components/ui/MobileHeader";
import { COLORS } from "../lib/constants/colors";

export default function DeseosScreen() {
  return (
    <View className="flex-1 bg-background">
      <MobileHeader variant="sub" title="Deseos" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 100, alignItems: "center", justifyContent: "center", flex: 1 }}
      >
        <Heart size={48} color={COLORS.sageDark} />
        <Text className="text-[15px] font-inter-semibold text-foreground text-center">
          Lista de deseos
        </Text>
        <Text className="text-[13px] font-inter text-muted-foreground text-center max-w-[260px]">
          Aquí podrás guardar metas de ahorro y evaluar decisiones de compra. Disponible pronto.
        </Text>
      </ScrollView>
    </View>
  );
}
