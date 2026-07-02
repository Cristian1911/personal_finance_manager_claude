import { useCallback, useMemo, useState } from "react";
import { View, Text, TextInput, RefreshControl, Pressable } from "react-native";
import { AppKeyboardAwareScrollView } from "../common/AppKeyboardAwareScrollView";
import { useFocusEffect, useRouter } from "expo-router";
import { Search, Store } from "lucide-react-native";
import { useSync } from "../../lib/sync/hooks";
import {
  getAllDestinatarios,
  getDestinatarioSuggestions,
  type DestinatarioSuggestionResult,
  type DestinatarioWithCount,
} from "../../lib/repositories/destinatarios";
import { COLORS } from "../../lib/constants/colors";
import {
  MOBILE_TAB_BAR_CLEARANCE,
  PANEL_INSET_CLASS,
  SECTION_EYEBROW_CLASS,
} from "../../lib/constants/styles";
import { MobileHeader } from "../ui/MobileHeader";
import { MCard } from "../ui/MCard";
import { DestinatarioRow } from "./DestinatarioRow";
import { DestinatarioSuggestions } from "./DestinatarioSuggestions";

type RootTab = "lista" | "sugerencias";

export function DestinatariosRoot() {
  const { sync } = useSync();
  const router = useRouter();

  const [refreshing, setRefreshing] = useState(false);
  const [destinatarios, setDestinatarios] = useState<DestinatarioWithCount[]>(
    []
  );
  const [suggestions, setSuggestions] = useState<
    DestinatarioSuggestionResult[]
  >([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState<RootTab>("lista");

  const loadData = useCallback(async () => {
    try {
      const [data, sugs] = await Promise.all([
        getAllDestinatarios(),
        getDestinatarioSuggestions(),
      ]);
      setDestinatarios(data);
      setSuggestions(sugs);
    } catch (error) {
      console.error("Failed to load destinatarios:", error);
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await sync();
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [sync, loadData]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return destinatarios;
    const q = searchQuery.toLowerCase();
    return destinatarios.filter((d) => d.name.toLowerCase().includes(q));
  }, [destinatarios, searchQuery]);

  const handleRowPress = useCallback(
    (id: string) => {
      router.push(`/destinatarios/${id}`);
    },
    [router]
  );

  const handleSuggestionsChanged = useCallback(() => {
    void loadData();
    void sync();
  }, [loadData, sync]);

  return (
    <View className="flex-1 bg-background">
      <MobileHeader variant="sub" title="Destinatarios" />

      <AppKeyboardAwareScrollView
        contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: MOBILE_TAB_BAR_CLEARANCE }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.brass}
          />
        }
      >
        {/* Lista / Sugerencias segmented toggle */}
        <View
          accessibilityRole="tablist"
          className={`${PANEL_INSET_CLASS} flex-row gap-1 p-1`}
        >
          {(
            [
              { id: "lista", label: "Lista" },
              {
                id: "sugerencias",
                label:
                  suggestions.length > 0
                    ? `Sugerencias (${suggestions.length})`
                    : "Sugerencias",
              },
            ] as const
          ).map((opt) => {
            const selected = tab === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setTab(opt.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={opt.label}
                className={`flex-1 items-center rounded-lg py-2 ${
                  selected ? "bg-z-surface-2-80" : ""
                }`}
              >
                <Text
                  className={`text-[13px] font-inter-semibold ${
                    selected ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === "sugerencias" ? (
          <DestinatarioSuggestions
            suggestions={suggestions}
            loading={suggestionsLoading}
            onChanged={handleSuggestionsChanged}
          />
        ) : (
          <>
            {/* Search bar */}
            <View className="flex-row items-center gap-2 rounded-xl border border-white-6 bg-z-surface-2-55 px-3 py-2">
              <Search size={16} color={COLORS.sageDark} />
              <TextInput
                className="flex-1 text-sm font-inter text-foreground"
                placeholder="Buscar destinatario..."
                placeholderTextColor={COLORS.sageDark}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Summary */}
            <MCard className="flex-row items-center gap-3">
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-z-brass-10">
                <Store size={18} color={COLORS.brass} />
              </View>
              <View className="flex-1">
                <Text className="text-[22px] font-inter-bold text-foreground">
                  {destinatarios.length}
                </Text>
                <Text className="text-[11px] font-inter text-muted-foreground">
                  {destinatarios.length === 1
                    ? "destinatario activo"
                    : "destinatarios activos"}
                </Text>
              </View>
            </MCard>

            {/* List */}
            {filtered.length === 0 ? (
              <View className="items-center justify-center py-16">
                <View className="h-12 w-12 items-center justify-center rounded-2xl bg-z-brass-10 mb-3">
                  <Store size={24} color={COLORS.brass} />
                </View>
                <Text className="text-[13px] font-inter-medium text-foreground mb-1">
                  No hay destinatarios
                </Text>
                <Text className="text-[11px] font-inter text-muted-foreground text-center px-8">
                  {searchQuery.trim()
                    ? "No se encontraron resultados para tu búsqueda"
                    : "Los destinatarios se crean automáticamente al importar transacciones"}
                </Text>
              </View>
            ) : (
              <View>
                <Text className={`mb-2 ${SECTION_EYEBROW_CLASS}`}>
                  DESTINATARIOS
                </Text>
                <MCard className="p-0 overflow-hidden">
                  {filtered.map((d, idx) => (
                    <View
                      key={d.id}
                      className={
                        idx < filtered.length - 1
                          ? "border-b border-white-6"
                          : ""
                      }
                    >
                      <DestinatarioRow
                        id={d.id}
                        name={d.name}
                        categoryName={d.category_name}
                        transactionCount={d.transaction_count}
                        onPress={handleRowPress}
                      />
                    </View>
                  ))}
                </MCard>
              </View>
            )}
          </>
        )}
      </AppKeyboardAwareScrollView>
    </View>
  );
}
