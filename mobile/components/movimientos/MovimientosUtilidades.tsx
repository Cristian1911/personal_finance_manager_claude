import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Check, Search, SlidersHorizontal, X } from "lucide-react-native";
import { COLORS } from "../../lib/constants/colors";
import { BRASS_BUTTON_CLASS, SECTION_EYEBROW_CLASS } from "../../lib/constants/styles";
import { MobileSheet } from "../ui/MobileSheet";
import type { AccountRow } from "../../lib/repositories/accounts";

export type DirectionFilter = "all" | "INFLOW" | "OUTFLOW";

export interface MovimientosFilters {
  accountId: string | null;
  direction: DirectionFilter;
  showExcluded: boolean;
}

interface MovimientosUtilidadesProps {
  accounts: AccountRow[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters: MovimientosFilters;
  onFiltersChange: (filters: MovimientosFilters) => void;
}

const PILL_BASE =
  "flex-row items-center justify-center rounded-full border border-white-6 bg-black-10";

const PILL_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

export function MovimientosUtilidades({
  accounts,
  searchValue,
  onSearchChange,
  filters,
  onFiltersChange,
}: MovimientosUtilidadesProps) {
  const [searchOpen, setSearchOpen] = useState(searchValue.length > 0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (localSearch === searchValue) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearchChange(localSearch.trim()), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [localSearch, searchValue, onSearchChange]);

  const activeCount =
    (filters.accountId ? 1 : 0) +
    (filters.direction !== "all" ? 1 : 0) +
    (filters.showExcluded ? 1 : 0);

  return (
    <View style={{ gap: 8 }}>
      <View className="flex-row flex-wrap gap-1.5">
        <Pressable
          onPress={() => setSearchOpen((prev) => !prev)}
          hitSlop={PILL_HIT_SLOP}
          className={`${PILL_BASE} h-8 w-8 ${searchOpen ? "border-z-brass-30 bg-z-brass-10" : ""}`}
          accessibilityLabel="Buscar"
        >
          <Search size={14} color={searchOpen ? COLORS.brass : COLORS.sageDark} />
        </Pressable>

        <Pressable
          onPress={() => setFilterOpen(true)}
          hitSlop={PILL_HIT_SLOP}
          accessibilityLabel={`Filtrar${activeCount > 0 ? ` (${activeCount} activos)` : ""}`}
          className={`${PILL_BASE} gap-1.5 px-3 py-1.5 ${activeCount > 0 ? "border-z-brass-30 bg-z-brass-10" : ""}`}
        >
          <SlidersHorizontal size={12} color={activeCount > 0 ? COLORS.brass : COLORS.sageDark} />
          <Text
            className={`text-[10px] font-inter-semibold ${activeCount > 0 ? "text-z-brass" : "text-muted-foreground"}`}
          >
            Filtrar{activeCount > 0 ? ` · ${activeCount}` : ""}
          </Text>
        </Pressable>

        {activeCount > 0 && (
          <Pressable
            onPress={() =>
              onFiltersChange({ accountId: null, direction: "all", showExcluded: false })
            }
            hitSlop={PILL_HIT_SLOP}
            accessibilityLabel="Limpiar filtros"
            className="flex-row items-center gap-1 rounded-full border border-white-6 bg-black-10 px-3 py-1.5"
          >
            <X size={11} color={COLORS.sageDark} />
            <Text className="text-[10px] font-inter-medium text-muted-foreground">
              Limpiar
            </Text>
          </Pressable>
        )}
      </View>

      {searchOpen && (
        <TextInput
          value={localSearch}
          onChangeText={setLocalSearch}
          placeholder="Buscar movimiento..."
          placeholderTextColor={COLORS.sageDark}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          className="rounded-xl border border-white-6 bg-black-10 px-3 py-2 text-sm font-inter text-foreground"
        />
      )}

      <MobileSheet visible={filterOpen} onClose={() => setFilterOpen(false)}>
        <FilterDrawerBody
          onClose={() => setFilterOpen(false)}
          accounts={accounts}
          filters={filters}
          onChange={onFiltersChange}
        />
      </MobileSheet>
    </View>
  );
}

/* ─── Filter drawer body ──────────────────────────────────────────────── */

function FilterDrawerBody({
  onClose,
  accounts,
  filters,
  onChange,
}: {
  onClose: () => void;
  accounts: AccountRow[];
  filters: MovimientosFilters;
  onChange: (filters: MovimientosFilters) => void;
}) {
  return (
    <View>
      <View className="flex-row items-center justify-between px-4 pt-2 pb-2">
        <Text className="text-[15px] font-inter-semibold text-foreground">
          Filtros
        </Text>
        <Pressable
          onPress={onClose}
          hitSlop={PILL_HIT_SLOP}
          className="h-8 w-8 items-center justify-center rounded-full"
          accessibilityLabel="Cerrar"
        >
          <X size={16} color={COLORS.sageLight} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <FilterSection label="Dirección">
          <View className="flex-row gap-1.5">
            {(
              [
                { id: "all", label: "Todas" },
                { id: "INFLOW", label: "Ingresos" },
                { id: "OUTFLOW", label: "Gastos" },
              ] as const
            ).map((opt) => {
              const active = filters.direction === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => onChange({ ...filters, direction: opt.id })}
                  className={`flex-1 rounded-xl border px-3 py-2 items-center ${
                    active
                      ? "border-z-brass-30 bg-z-brass-10"
                      : "border-white-6 bg-black-10"
                  }`}
                >
                  <Text
                    className={`text-xs font-inter-semibold ${active ? "text-z-brass" : "text-muted-foreground"}`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </FilterSection>

        <FilterSection label="Cuenta">
          <View className="rounded-2xl border border-white-6 bg-z-surface-2-55 overflow-hidden">
            <AccountOption
              label="Todas las cuentas"
              active={filters.accountId === null}
              onPress={() => onChange({ ...filters, accountId: null })}
            />
            {accounts.map((a) => (
              <AccountOption
                key={a.id}
                label={a.name}
                color={a.color}
                active={filters.accountId === a.id}
                onPress={() => onChange({ ...filters, accountId: a.id })}
              />
            ))}
          </View>
        </FilterSection>

        <FilterSection label="Visibilidad">
          <Pressable
            onPress={() => onChange({ ...filters, showExcluded: !filters.showExcluded })}
            className="flex-row items-center justify-between rounded-2xl border border-white-6 bg-z-surface-2-55 px-4 py-3"
          >
            <View className="flex-1">
              <Text className="text-[13px] font-inter-medium text-foreground">
                Mostrar excluidas
              </Text>
              <Text className="text-[10px] font-inter text-muted-foreground">
                Incluye transacciones marcadas como excluidas del presupuesto.
              </Text>
            </View>
            <View
              className={`h-5 w-5 items-center justify-center rounded-md border ${
                filters.showExcluded
                  ? "border-z-brass bg-z-brass"
                  : "border-white-8 bg-black-10"
              }`}
            >
              {filters.showExcluded && <Check size={12} color={COLORS.ink} />}
            </View>
          </Pressable>
        </FilterSection>

        <Pressable
          onPress={onClose}
          className={`${BRASS_BUTTON_CLASS} mt-4 rounded-xl py-3 items-center active:opacity-80`}
        >
          <Text className="text-sm font-inter-semibold text-z-ink">Aplicar</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function FilterSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-4">
      <Text className={`mb-2 ${SECTION_EYEBROW_CLASS}`}>{label}</Text>
      {children}
    </View>
  );
}

function AccountOption({
  label,
  color,
  active,
  onPress,
}: {
  label: string;
  color?: string | null;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-3 px-3.5 py-2.5 border-b border-white-6 last:border-b-0 ${active ? "bg-z-brass-10" : ""} active:bg-z-surface-2-5`}
    >
      {color ? (
        <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      ) : (
        <View className="h-2.5 w-2.5 rounded-full bg-z-sage-20" />
      )}
      <Text
        className={`flex-1 text-[13px] font-inter-medium ${active ? "text-z-brass" : "text-foreground"}`}
      >
        {label}
      </Text>
      {active && <Check size={14} color={COLORS.brass} />}
    </Pressable>
  );
}

