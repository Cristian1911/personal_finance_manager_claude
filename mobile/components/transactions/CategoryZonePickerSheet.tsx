import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronDown, Search, X } from "lucide-react-native";
import { COLORS } from "../../lib/constants/colors";
import {
  chipBackground,
  zoneBackground,
  zoneBorder,
  zoneTextColor,
} from "../../lib/utils/zone-colors";

export type CategoryRow = {
  id: string;
  name: string;
  name_es: string | null;
  color: string | null;
  parent_id: string | null;
};

type Zone = CategoryRow & { children: CategoryRow[] };

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (id: string | null, name: string | null) => void;
  selectedId: string | null;
  /** Pre-filtered by direction in the caller. */
  categories: CategoryRow[];
};

function displayName(cat: CategoryRow): string {
  return cat.name_es ?? cat.name;
}

function groupZones(cats: CategoryRow[]): {
  zones: Zone[];
  standalone: CategoryRow[];
} {
  const roots = cats.filter((c) => !c.parent_id);
  const childrenByParent = new Map<string, CategoryRow[]>();
  for (const cat of cats) {
    if (!cat.parent_id) continue;
    const arr = childrenByParent.get(cat.parent_id) ?? [];
    arr.push(cat);
    childrenByParent.set(cat.parent_id, arr);
  }
  const zones: Zone[] = [];
  const standalone: CategoryRow[] = [];
  for (const root of roots) {
    const kids = childrenByParent.get(root.id) ?? [];
    if (kids.length > 0) {
      zones.push({ ...root, children: kids });
    } else {
      standalone.push(root);
    }
  }
  return { zones, standalone };
}

function findParentZone(zones: Zone[], id: string | null): Zone | null {
  if (!id) return null;
  for (const z of zones) {
    if (z.id === id) return z;
    if (z.children.some((c) => c.id === id)) return z;
  }
  return null;
}

function ZoneTile({
  zone,
  isExpanded,
  onPress,
}: {
  zone: Zone;
  isExpanded: boolean;
  onPress: () => void;
}) {
  const color = zone.color ?? "#938C7E";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Zona ${displayName(zone)}`}
      accessibilityState={{ expanded: isExpanded }}
      style={{
        backgroundColor: zoneBackground(color),
        borderColor: isExpanded ? color : zoneBorder(color),
        borderWidth: 1,
      }}
      className="flex-1 flex-row items-center justify-between rounded-xl px-3 py-3"
    >
      <View className="flex-row items-center gap-2 flex-1">
        <View
          style={{ backgroundColor: color }}
          className="h-2.5 w-2.5 rounded-full"
        />
        <Text
          style={{ color: zoneTextColor(color) }}
          className="text-[13px] font-inter-semibold flex-1"
          numberOfLines={1}
        >
          {displayName(zone)}
        </Text>
      </View>
      <ChevronDown
        size={14}
        color={zoneTextColor(color)}
        style={{ transform: [{ rotate: isExpanded ? "180deg" : "0deg" }] }}
      />
    </Pressable>
  );
}

function SubRow({
  cat,
  color,
  isSelected,
  onPress,
}: {
  cat: CategoryRow;
  color: string | null | undefined;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      className={`flex-row items-center gap-2.5 rounded-lg px-3 py-2.5 active:bg-white/5 ${
        isSelected ? "bg-white/8" : ""
      }`}
    >
      <View
        style={{
          backgroundColor: chipBackground(color),
          borderColor: zoneBorder(color),
          borderWidth: 1,
        }}
        className="h-6 w-6 rounded-full"
      />
      <Text
        className="flex-1 text-sm font-inter text-foreground"
        numberOfLines={1}
      >
        {displayName(cat)}
      </Text>
      {isSelected && <Check size={16} color={COLORS.brass} />}
    </Pressable>
  );
}

export function CategoryZonePickerSheet({
  visible,
  onClose,
  onSelect,
  selectedId,
  categories,
}: Props) {
  const insets = useSafeAreaInsets();
  const { zones, standalone } = useMemo(
    () => groupZones(categories),
    [categories]
  );

  const [search, setSearch] = useState("");
  const [expandedZoneId, setExpandedZoneId] = useState<string | null>(() => {
    const parent = findParentZone(zones, selectedId);
    return parent?.id ?? null;
  });

  const query = search.trim().toLowerCase();

  const searchResults = useMemo(() => {
    if (!query) return null;
    const groups: Array<{ zone: Zone; children: CategoryRow[] }> = [];
    for (const zone of zones) {
      const zoneHit = displayName(zone).toLowerCase().includes(query);
      const matching = zone.children.filter((c) =>
        displayName(c).toLowerCase().includes(query)
      );
      if (zoneHit) {
        groups.push({ zone, children: zone.children });
      } else if (matching.length > 0) {
        groups.push({ zone, children: matching });
      }
    }
    const matchStandalone = standalone.filter((c) =>
      displayName(c).toLowerCase().includes(query)
    );
    return { groups, standalone: matchStandalone };
  }, [query, zones, standalone]);

  const hasResults =
    !!searchResults &&
    (searchResults.groups.length > 0 || searchResults.standalone.length > 0);

  function reset() {
    setSearch("");
  }

  function handleSelect(id: string | null, name: string | null) {
    reset();
    onSelect(id, name);
    onClose();
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Pressable
        onPress={handleClose}
        style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        className="flex-1 justify-end"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="max-h-[82%] rounded-t-2xl border-t border-white-6 bg-background"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <View className="mx-auto mt-3 mb-3 h-1 w-10 rounded-full bg-white-10" />

          {/* Header */}
          <View className="flex-row items-center justify-between px-4 pb-3 border-b border-white-6">
            <View>
              <Text className="text-base font-inter-bold text-foreground">
                Elegir categoría
              </Text>
              <Text className="mt-0.5 text-[11px] font-inter text-muted-foreground">
                Elige la zona y subcategoría que describe este movimiento.
              </Text>
            </View>
            <Pressable
              onPress={handleClose}
              className="h-8 w-8 items-center justify-center rounded-full bg-black-10 active:bg-white/10"
              accessibilityLabel="Cerrar"
            >
              <X size={16} color={COLORS.sageDark} />
            </Pressable>
          </View>

          {/* Search */}
          <View className="px-4 py-3 border-b border-white-6">
            <View className="flex-row items-center gap-2 rounded-xl border border-white-6 bg-black-10 px-3 py-2">
              <Search size={14} color={COLORS.sageDark} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar categoría…"
                placeholderTextColor={COLORS.sageDark}
                className="flex-1 text-sm font-inter text-foreground"
                autoCorrect={false}
                autoCapitalize="none"
              />
              {search.length > 0 && (
                <Pressable
                  onPress={() => setSearch("")}
                  accessibilityLabel="Limpiar búsqueda"
                >
                  <X size={14} color={COLORS.sageDark} />
                </Pressable>
              )}
            </View>
          </View>

          <ScrollView
            className="px-3"
            contentContainerStyle={{ paddingVertical: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            {query ? (
              // --- Search mode ---
              <>
                {searchResults?.groups.map(({ zone, children }) => (
                  <View key={zone.id} className="mb-4">
                    <View className="flex-row items-center gap-2 px-1 mb-1.5">
                      <View
                        style={{ backgroundColor: zone.color ?? "#938C7E" }}
                        className="h-2 w-2 rounded-full"
                      />
                      <Text
                        style={{ color: zoneTextColor(zone.color) }}
                        className="text-[11px] font-inter-semibold uppercase tracking-wide"
                      >
                        {displayName(zone)}
                      </Text>
                    </View>
                    <View className="gap-0.5">
                      {children.map((c) => (
                        <SubRow
                          key={c.id}
                          cat={c}
                          color={zone.color}
                          isSelected={selectedId === c.id}
                          onPress={() => handleSelect(c.id, displayName(c))}
                        />
                      ))}
                    </View>
                  </View>
                ))}
                {searchResults && searchResults.standalone.length > 0 && (
                  <View className="mb-4">
                    <Text className="px-1 mb-1.5 text-[11px] font-inter-semibold uppercase tracking-wide text-muted-foreground">
                      Otros
                    </Text>
                    <View className="gap-0.5">
                      {searchResults.standalone.map((c) => (
                        <SubRow
                          key={c.id}
                          cat={c}
                          color={c.color}
                          isSelected={selectedId === c.id}
                          onPress={() => handleSelect(c.id, displayName(c))}
                        />
                      ))}
                    </View>
                  </View>
                )}
                {!hasResults && (
                  <View className="items-center py-8">
                    <Text className="text-sm font-inter text-muted-foreground">
                      Sin resultados para "{search}"
                    </Text>
                  </View>
                )}
              </>
            ) : (
              // --- Zone grid mode ---
              <>
                <View className="gap-2">
                  {Array.from(
                    { length: Math.ceil(zones.length / 2) },
                    (_, rowIdx) => {
                      const pair = zones.slice(rowIdx * 2, rowIdx * 2 + 2);
                      const expandedInRow = pair.find(
                        (z) => z.id === expandedZoneId
                      );
                      return (
                        <View key={rowIdx}>
                          <View className="flex-row gap-2">
                            {pair.map((zone) => (
                              <ZoneTile
                                key={zone.id}
                                zone={zone}
                                isExpanded={expandedZoneId === zone.id}
                                onPress={() =>
                                  setExpandedZoneId(
                                    expandedZoneId === zone.id ? null : zone.id
                                  )
                                }
                              />
                            ))}
                            {pair.length === 1 && <View className="flex-1" />}
                          </View>
                          {expandedInRow && (
                            <View
                              className="mt-2 rounded-xl border border-white-6 bg-black-10 p-2 gap-0.5"
                              style={{
                                borderColor: zoneBorder(expandedInRow.color),
                              }}
                            >
                              <Pressable
                                onPress={() =>
                                  handleSelect(
                                    expandedInRow.id,
                                    displayName(expandedInRow)
                                  )
                                }
                                className={`flex-row items-center gap-2.5 rounded-lg px-3 py-2.5 active:bg-white/5 ${
                                  selectedId === expandedInRow.id
                                    ? "bg-white/8"
                                    : ""
                                }`}
                              >
                                <Text
                                  style={{
                                    color: zoneTextColor(expandedInRow.color),
                                  }}
                                  className="flex-1 text-xs font-inter-semibold uppercase tracking-wide"
                                >
                                  Toda la zona
                                </Text>
                                {selectedId === expandedInRow.id && (
                                  <Check size={14} color={COLORS.brass} />
                                )}
                              </Pressable>
                              {expandedInRow.children.map((c) => (
                                <SubRow
                                  key={c.id}
                                  cat={c}
                                  color={expandedInRow.color}
                                  isSelected={selectedId === c.id}
                                  onPress={() =>
                                    handleSelect(c.id, displayName(c))
                                  }
                                />
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    }
                  )}
                </View>

                {standalone.length > 0 && (
                  <View className="mt-4 gap-0.5">
                    {standalone.map((c) => (
                      <SubRow
                        key={c.id}
                        cat={c}
                        color={c.color}
                        isSelected={selectedId === c.id}
                        onPress={() => handleSelect(c.id, displayName(c))}
                      />
                    ))}
                  </View>
                )}

                <Pressable
                  onPress={() => handleSelect(null, null)}
                  className={`mt-4 flex-row items-center gap-2.5 rounded-lg px-3 py-2.5 active:bg-white/5 ${
                    selectedId === null ? "bg-white/8" : ""
                  }`}
                >
                  <X size={14} color={COLORS.sageDark} />
                  <Text className="flex-1 text-sm font-inter text-muted-foreground">
                    Sin categoría
                  </Text>
                  {selectedId === null && <Check size={16} color={COLORS.brass} />}
                </Pressable>
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
