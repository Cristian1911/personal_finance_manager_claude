import { View, Text, Pressable } from "react-native";
import { Tag, Upload } from "lucide-react-native";
import { useRouter } from "expo-router";
import { COLORS } from "../../lib/constants/colors";
import { MobileZone } from "../ui/MobileZone";
import { PANEL_INSET_CLASS } from "../../lib/constants/styles";

interface MovimientosHerramientasProps {
  uncategorizedCount: number;
}

export function MovimientosHerramientas({
  uncategorizedCount,
}: MovimientosHerramientasProps) {
  const router = useRouter();

  return (
    <MobileZone eyebrow="HERRAMIENTAS">
      <View className="flex-row gap-1.5">
        {/* Categorize chip */}
        <Pressable
          onPress={() => router.push("/categorizar" as any)}
          className={`${PANEL_INSET_CLASS} flex-1 items-center p-3`}
        >
          <View className="h-8 w-8 items-center justify-center rounded-xl bg-z-brass-10 mb-1.5">
            <Tag size={16} color={COLORS.brass} />
          </View>
          <Text className="text-[10px] font-inter-semibold text-muted-foreground">
            Categorizar
          </Text>
          {uncategorizedCount > 0 && (
            <View className="mt-1 rounded-full bg-z-brass px-1.5 py-0.5">
              <Text className="text-[9px] font-inter-bold text-z-ink">
                {uncategorizedCount}
              </Text>
            </View>
          )}
        </Pressable>

        {/* Import chip */}
        <Pressable
          onPress={() => router.push("/(tabs)/import" as any)}
          className={`${PANEL_INSET_CLASS} flex-1 items-center p-3`}
        >
          <View className="h-8 w-8 items-center justify-center rounded-xl bg-z-brass-10 mb-1.5">
            <Upload size={16} color={COLORS.brass} />
          </View>
          <Text className="text-[10px] font-inter-semibold text-muted-foreground">
            Importar
          </Text>
          <Text className="mt-1 text-[9px] font-inter text-muted-fg-50">
            PDF o extracto
          </Text>
        </Pressable>
      </View>
    </MobileZone>
  );
}
