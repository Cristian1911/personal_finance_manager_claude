import { View, Text, Pressable, ScrollView } from "react-native";
import { X, Plus } from "lucide-react-native";
import { COLORS } from "../../lib/constants/colors";
import { MobileSheet } from "../ui/MobileSheet";
import {
  WIDGET_CATALOG,
  type CatalogEntry,
  type WidgetType,
} from "../../lib/dashboard/widgets";

interface AddWidgetSheetProps {
  open: boolean;
  onClose: () => void;
  onAdd: (type: WidgetType) => void;
  existingTypes: Set<WidgetType>;
}

export function AddWidgetSheet({
  open,
  onClose,
  onAdd,
  existingTypes,
}: AddWidgetSheetProps) {
  return (
    <MobileSheet visible={open} onClose={onClose} maxHeightClass="max-h-[70%]">
      <View className="flex-row items-center justify-between px-4 pb-3 pt-1">
        <View>
          <Text className="text-sm font-inter-semibold text-foreground">
            Añadir widget
          </Text>
          <Text className="mt-0.5 text-[11px] font-inter text-muted-foreground">
            Personaliza tu inicio
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          accessibilityLabel="Cerrar"
          className="h-8 w-8 items-center justify-center rounded-full"
        >
          <X size={18} color={COLORS.sageDark} />
        </Pressable>
      </View>

      <View className="h-px bg-z-surface-2-6 mx-4" />

      <ScrollView
        style={{ flexShrink: 1 }}
        contentContainerStyle={{ paddingVertical: 8 }}
      >
        {WIDGET_CATALOG.map((entry) => (
          <CatalogRow
            key={entry.type}
            entry={entry}
            disabled={!entry.available || existingTypes.has(entry.type)}
            onPress={() => {
              onAdd(entry.type);
              onClose();
            }}
          />
        ))}
      </ScrollView>
    </MobileSheet>
  );
}

function CatalogRow({
  entry,
  disabled,
  onPress,
}: {
  entry: CatalogEntry;
  disabled: boolean;
  onPress: () => void;
}) {
  const exists = !entry.available ? false : disabled;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={`flex-row items-center gap-3 px-4 py-3 ${disabled ? "opacity-40" : ""}`}
    >
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-inter-medium text-foreground">
          {entry.label}
        </Text>
        <Text className="mt-0.5 text-[11px] font-inter text-muted-foreground">
          {!entry.available
            ? "Próximamente"
            : exists
              ? "Ya en tu inicio"
              : entry.description}
        </Text>
      </View>
      <View className="h-7 w-7 items-center justify-center rounded-full border border-z-brass-20 bg-z-brass-10">
        <Plus size={14} color={COLORS.brass} />
      </View>
    </Pressable>
  );
}
