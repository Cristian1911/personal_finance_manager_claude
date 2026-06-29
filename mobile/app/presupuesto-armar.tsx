import { memo, useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { AppKeyboardAwareScrollView } from "../components/common/AppKeyboardAwareScrollView";
import { MobileHeader } from "../components/ui/MobileHeader";
import { CategoryIcon } from "../components/ui/CategoryIcon";
import { useAuth } from "../lib/auth";
import {
  getBudgetBuilderRows,
  getMonthlyIncome,
  saveBudgetDraft,
  type BudgetBuilderRow,
} from "../lib/repositories/budgets";
import { toLocalMonthString } from "../lib/utils/date";
import { parseLocalizedAmount } from "../lib/amount";
import { COLORS } from "../lib/constants/colors";
import {
  BRASS_BUTTON_CLASS,
  MOBILE_CARD_TIGHT_CLASS,
  PANEL_SURFACE_SUBTLE_CLASS,
} from "../lib/constants/styles";
import { chipBackground, zoneTextColor } from "../lib/utils/zone-colors";

const CURRENCY: CurrencyCode = "COP";
const TABULAR = { fontVariant: ["tabular-nums" as const] };

type Zone = {
  parent: BudgetBuilderRow;
  rows: BudgetBuilderRow[];
};

const BudgetLineRow = memo(function BudgetLineRow({
  id,
  row,
  label,
  value,
  onSetAmount,
  last,
}: {
  id: string;
  row: BudgetBuilderRow;
  label?: string;
  value: string;
  onSetAmount: (id: string, v: string) => void;
  last: boolean;
}) {
  const color = row.category_color;
  const handleChange = useCallback(
    (v: string) => onSetAmount(id, v),
    [id, onSetAmount]
  );
  return (
    <View
      className={`flex-row items-center gap-3 px-3.5 py-3 ${last ? "" : "border-b border-white-6"}`}
    >
      {row.category_icon ? (
        <View
          className="h-7 w-7 items-center justify-center rounded-full"
          style={{ backgroundColor: chipBackground(color) }}
        >
          <CategoryIcon icon={row.category_icon} size={14} color={color ?? COLORS.sageDark} />
        </View>
      ) : null}
      <View className="flex-1 min-w-0">
        <Text className="text-sm font-inter-medium text-foreground" numberOfLines={1}>
          {label ?? row.category_name}
        </Text>
        {row.avg3m > 0 && !value ? (
          <Pressable
            onPress={() => handleChange(String(row.avg3m))}
            accessibilityRole="button"
            accessibilityLabel={`Usar promedio de ${row.category_name}`}
            className="mt-0.5 self-start active:opacity-70"
          >
            <Text className="text-[11px] font-inter text-z-brass">
              Desde transacciones · prom {formatCurrency(row.avg3m, CURRENCY)}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <TextInput
        value={value}
        onChangeText={handleChange}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={COLORS.sageDark}
        className="w-28 rounded-xl border border-white-6 bg-black-10 px-3 py-2 text-right text-sm font-inter-medium text-foreground"
        style={TABULAR}
      />
    </View>
  );
});

export default function ArmarPresupuestoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const [rows, setRows] = useState<BudgetBuilderRow[]>([]);
  const [income, setIncome] = useState(0);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [data, inc] = await Promise.all([
        getBudgetBuilderRows(),
        getMonthlyIncome(toLocalMonthString()),
      ]);
      const d: Record<string, string> = {};
      const o: Record<string, number> = {};
      for (const r of data) {
        o[r.category_id] = r.amount;
        if (r.amount > 0) d[r.category_id] = String(Math.round(r.amount));
      }
      setRows(data);
      setIncome(inc);
      setDraft(d);
      setOriginal(o);
    } catch (error) {
      console.error("Failed to load budget builder:", error);
      Alert.alert("Error", "No se pudieron cargar los datos del presupuesto.");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const zones = useMemo<Zone[]>(() => {
    const byParent = new Map<string, BudgetBuilderRow[]>();
    const parents: BudgetBuilderRow[] = [];
    for (const r of rows) {
      if (r.parent_id) {
        const arr = byParent.get(r.parent_id) ?? [];
        arr.push(r);
        byParent.set(r.parent_id, arr);
      } else {
        parents.push(r);
      }
    }
    return parents.map((p) => ({ parent: p, rows: byParent.get(p.category_id) ?? [] }));
  }, [rows]);

  const total = useMemo(
    () =>
      Object.values(draft).reduce((s, v) => s + (parseLocalizedAmount(v) || 0), 0),
    [draft]
  );
  const remaining = income - total;

  const setAmount = useCallback(
    (id: string, v: string) => setDraft((p) => ({ ...p, [id]: v })),
    []
  );

  const handleSave = useCallback(async () => {
    if (!session?.user?.id) return;
    setSaving(true);
    try {
      await saveBudgetDraft(
        session.user.id,
        rows.map((r) => ({
          budgetId: r.budget_id,
          categoryId: r.category_id,
          amount: parseLocalizedAmount(draft[r.category_id] ?? "") || 0,
          prev: original[r.category_id] ?? 0,
        }))
      );
      router.back();
    } catch (error) {
      console.error("Failed to save budget:", error);
      Alert.alert("Error", "No se pudo guardar el presupuesto. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }, [rows, draft, original, session?.user?.id, router]);

  if (loading) {
    return (
      <View className="flex-1 bg-background">
        <MobileHeader variant="sub" title="Armar presupuesto" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={COLORS.brass} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <MobileHeader variant="sub" title="Armar presupuesto" />

      <AppKeyboardAwareScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 96,
          gap: 12,
        }}
        scrollIndicatorInsets={{ bottom: 96 }}
      >
        {/* Σ summary */}
        <View className={`${PANEL_SURFACE_SUBTLE_CLASS} p-4`}>
          <Text className="text-[13px] font-inter text-muted-foreground">
            Presupuesta{" "}
            <Text className="font-inter-semibold text-z-income">
              solo lo que te importa
            </Text>{" "}
            — no tienes que llenar todo.
          </Text>
          <View className="mt-3 flex-row items-baseline justify-between">
            <Text className="text-2xl font-inter-bold text-foreground" style={TABULAR}>
              {formatCurrency(total, CURRENCY)}
            </Text>
            {income > 0 ? (
              <Text className="text-[11px] font-inter text-muted-foreground" style={TABULAR}>
                de {formatCurrency(income, CURRENCY)}
              </Text>
            ) : null}
          </View>
          {income > 0 ? (
            <>
              <View className="mt-2 h-2 rounded-full bg-black-10">
                <View
                  className={`h-2 rounded-full ${total > income ? "bg-z-debt" : "bg-z-brass"}`}
                  style={{ width: `${Math.min(100, (total / income) * 100)}%` }}
                />
              </View>
              <Text
                className={`mt-2 text-[12px] font-inter-medium ${remaining < 0 ? "text-z-debt" : "text-z-income"}`}
                style={TABULAR}
              >
                {remaining < 0
                  ? `${formatCurrency(-remaining, CURRENCY)} de más`
                  : `quedan ${formatCurrency(remaining, CURRENCY)}`}
              </Text>
            </>
          ) : null}
        </View>

        {/* Zones */}
        {zones.map((zone) => {
          const hasChildren = zone.rows.length > 0;
          const lineRows = hasChildren ? zone.rows : [];
          return (
            <View key={zone.parent.category_id}>
              <View className="mb-2 mt-1 flex-row items-center gap-2">
                {zone.parent.category_icon ? (
                  <View
                    className="h-6 w-6 items-center justify-center rounded-full"
                    style={{ backgroundColor: chipBackground(zone.parent.category_color) }}
                  >
                    <CategoryIcon
                      icon={zone.parent.category_icon}
                      size={13}
                      color={zoneTextColor(zone.parent.category_color)}
                    />
                  </View>
                ) : null}
                <Text
                  className="text-[11px] font-inter-semibold uppercase tracking-[4px]"
                  style={{ color: zoneTextColor(zone.parent.category_color) }}
                >
                  {zone.parent.category_name}
                </Text>
              </View>

              <View className={MOBILE_CARD_TIGHT_CLASS}>
                <BudgetLineRow
                  id={zone.parent.category_id}
                  row={zone.parent}
                  label={hasChildren ? "Base (general)" : zone.parent.category_name}
                  value={draft[zone.parent.category_id] ?? ""}
                  onSetAmount={setAmount}
                  last={!hasChildren}
                />
                {lineRows.map((r, i) => (
                  <BudgetLineRow
                    key={r.category_id}
                    id={r.category_id}
                    row={r}
                    value={draft[r.category_id] ?? ""}
                    onSetAmount={setAmount}
                    last={i === lineRows.length - 1}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </AppKeyboardAwareScrollView>

      {/* Guardar */}
      <View
        className="absolute inset-x-0 bottom-0 border-t border-white-6 bg-background px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <Pressable
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Guardar presupuesto"
          className={`${BRASS_BUTTON_CLASS} items-center rounded-xl py-3.5 active:opacity-80`}
          style={saving ? { opacity: 0.6 } : undefined}
        >
          <Text className="text-sm font-inter-bold text-z-ink">
            {saving ? "Guardando..." : "Guardar presupuesto"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
