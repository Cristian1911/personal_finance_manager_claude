import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { useSync } from "../../lib/sync/hooks";
import {
  deleteBudget,
  getBudgetProgress,
  type BudgetProgressRow,
  upsertBudget,
} from "../../lib/repositories/budgets";
import { parseLocalizedAmount } from "../../lib/amount";
import { useAuth } from "../../lib/auth";
import { MonthSelector } from "../../components/common/MonthSelector";
import { toLocalMonthString } from "../../lib/utils/date";
import { COLORS } from "../../lib/constants/colors";

function getProgressColor(progress: number) {
  if (progress >= 100) return "bg-z-debt";
  if (progress >= 80) return "bg-z-alert";
  return "bg-z-income";
}

export default function BudgetsScreen() {
  const { session } = useAuth();
  const { sync } = useSync();
  const [items, setItems] = useState<BudgetProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [currentMonth, setCurrentMonth] = useState(
    () => toLocalMonthString()
  );

  const loadData = useCallback(async () => {
    try {
      const data = await getBudgetProgress(currentMonth);
      setItems(data);
    } catch (error) {
      console.error("Failed to load budgets:", error);
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

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

  const totals = useMemo(() => {
    const target = items.reduce((sum, item) => sum + item.amount, 0);
    const spent = items.reduce((sum, item) => sum + item.spent, 0);
    const progress = target > 0 ? (spent / target) * 100 : 0;
    return { target, spent, progress };
  }, [items]);

  const beginEdit = (item: BudgetProgressRow) => {
    setEditingId(item.id ?? item.category_id);
    setAmountInput(String(Math.round(item.amount)));
  };

  const handleSave = useCallback(
    async (item: BudgetProgressRow) => {
      if (!session?.user?.id) return;
      const parsed = parseLocalizedAmount(amountInput);
      if (!Number.isFinite(parsed) || parsed <= 0) return;

      const recordId = item.id ?? item.category_id;
      setSavingId(recordId);
      try {
        await upsertBudget({
          id: item.id ?? undefined,
          user_id: session.user.id,
          category_id: item.category_id,
          amount: parsed,
          period: "monthly",
        });
        setEditingId(null);
        await loadData();
      } finally {
        setSavingId(null);
      }
    },
    [amountInput, session?.user?.id, loadData]
  );

  const handleDelete = useCallback(async (item: BudgetProgressRow) => {
    if (!item.id) return;
    setSavingId(item.id);
    try {
      await deleteBudget(item.id);
      if (editingId === item.id) {
        setEditingId(null);
        setAmountInput("");
      }
      await loadData();
    } finally {
      setSavingId(null);
    }
  }, [editingId, loadData]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={COLORS.brass} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        className="flex-1 bg-background"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.brass} />
        }
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      >
        <View className="px-4 pt-4">
          <MonthSelector month={currentMonth} onChange={setCurrentMonth} />
        </View>

        {/* Summary card */}
        <View className="mx-4 mt-3 rounded-2xl border border-white-6 bg-z-surface-2-55 p-5">
          <Text className="text-sm text-muted-foreground font-inter-medium">Control mensual</Text>
          <Text className="mt-1 text-2xl text-foreground font-inter-bold">
            {formatCurrency(totals.spent, "COP" as CurrencyCode)}
          </Text>
          <Text className="mt-1 text-xs text-muted-foreground font-inter">
            de {formatCurrency(totals.target, "COP" as CurrencyCode)} presupuestado
          </Text>
          <View className="mt-4 h-2 rounded-full bg-black-10">
            <View
              className={`${getProgressColor(totals.progress)} h-2 rounded-full`}
              style={{ width: `${Math.min(totals.progress, 100)}%` }}
            />
          </View>
        </View>

        {/* Section header */}
        <View className="px-4 pt-5 pb-2">
          <Text className="text-muted-foreground font-inter-semibold text-xs uppercase">
            Presupuestos por categoria
          </Text>
          <Text className="mt-1 text-xs text-muted-foreground font-inter">
            Toca una categoria para definir o editar su tope mensual.
          </Text>
        </View>

        {items.length === 0 ? (
          <View className="mx-4 mt-2 rounded-2xl border border-white-6 bg-z-surface-2-55 p-6">
            <Text className="text-center text-base text-foreground font-inter-medium">
              Aun no hay presupuestos configurados
            </Text>
            <Text className="mt-1 text-center text-sm text-muted-foreground font-inter">
              Crea presupuestos desde Categorias en web y aqui podras revisarlos.
            </Text>
          </View>
        ) : (
          <View className="px-4">
            {items.map((item) => {
              const rowId = item.id ?? item.category_id;
              const isEditing = editingId === rowId;
              const isSaving = savingId === rowId;
              return (
                <View key={rowId} className="mb-3 rounded-2xl border border-white-6 bg-z-surface-2-55 p-4">
                  <View className="mb-2 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <View
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.category_color ?? COLORS.sageDark }}
                      />
                      <Text className="text-foreground font-inter-semibold">{item.category_name}</Text>
                    </View>
                    <Text className="text-xs text-muted-foreground font-inter-medium">
                      {Math.round(item.progress)}%
                    </Text>
                  </View>

                  <Text className="text-sm text-muted-foreground font-inter">
                    {formatCurrency(item.spent, "COP" as CurrencyCode)} / {formatCurrency(item.amount, "COP" as CurrencyCode)}
                  </Text>

                  <View className="mt-3 h-2 rounded-full bg-black-10">
                    <View
                      className={`${getProgressColor(item.progress)} h-2 rounded-full`}
                      style={{ width: `${Math.min(item.progress, 100)}%` }}
                    />
                  </View>

                  {isEditing ? (
                    <View className="mt-3">
                      <TextInput
                        value={amountInput}
                        onChangeText={setAmountInput}
                        keyboardType="numeric"
                        placeholder="Monto mensual"
                        placeholderTextColor="#938C7E"
                        className="rounded-xl border border-white-6 bg-black-10 px-3 py-2.5 text-foreground"
                      />
                      <View className="mt-2 flex-row gap-2">
                        <Pressable
                          className="flex-1 rounded-xl bg-z-brass py-2.5 items-center active:opacity-80"
                          onPress={() => handleSave(item)}
                          disabled={isSaving}
                        >
                          <Text className="text-z-ink font-inter-semibold">
                            {isSaving ? "Guardando..." : "Guardar"}
                          </Text>
                        </Pressable>
                        <Pressable
                          className="rounded-xl border border-white-6 px-4 py-2.5 items-center"
                          onPress={() => {
                            setEditingId(null);
                            setAmountInput("");
                          }}
                          disabled={isSaving}
                        >
                          <Text className="text-muted-foreground font-inter-medium">Cancelar</Text>
                        </Pressable>
                        {!!item.id && (
                          <Pressable
                            className="rounded-xl border border-z-debt/25 px-4 py-2.5 items-center"
                            onPress={() => handleDelete(item)}
                            disabled={isSaving}
                          >
                            <Text className="text-z-expense font-inter-medium">Eliminar</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  ) : (
                    <Pressable className="mt-3 items-start" onPress={() => beginEdit(item)}>
                      <Text className="text-sm text-z-brass font-inter-semibold">
                        {item.id ? "Editar presupuesto" : "Definir presupuesto"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
