import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { formatCurrency, type CurrencyCode, formatMonthLabel } from "@venti5/shared";
import { useSync } from "../../lib/sync/hooks";
import {
  deleteBudget,
  getBudgetProgress,
  type BudgetProgressRow,
  upsertBudget,
} from "../../lib/repositories/budgets";
import { useAuth } from "../../lib/auth";

function getProgressColor(progress: number) {
  if (progress >= 100) return "bg-red-500";
  if (progress >= 80) return "bg-amber-500";
  return "bg-emerald-500";
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

  const currentMonth = new Date().toISOString().slice(0, 7);

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
      const parsed = Number(amountInput);
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
      <View className="flex-1 items-center justify-center bg-gray-100">
        <ActivityIndicator size="large" color="#047857" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-100"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#047857" />
      }
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View className="px-4 pt-4">
        <Text className="text-gray-500 font-inter-medium text-sm capitalize">
          {formatMonthLabel(new Date())}
        </Text>
      </View>

      <View className="mx-4 mt-3 rounded-2xl bg-white p-5 shadow-sm">
        <Text className="text-sm text-gray-500 font-inter-medium">Control mensual</Text>
        <Text className="mt-1 text-2xl text-gray-900 font-inter-bold">
          {formatCurrency(totals.spent, "COP" as CurrencyCode)}
        </Text>
        <Text className="mt-1 text-xs text-gray-500 font-inter">
          de {formatCurrency(totals.target, "COP" as CurrencyCode)} presupuestado
        </Text>
        <View className="mt-4 h-2 rounded-full bg-gray-200">
          <View
            className={`${getProgressColor(totals.progress)} h-2 rounded-full`}
            style={{ width: `${Math.min(totals.progress, 100)}%` }}
          />
        </View>
      </View>

      <View className="px-4 pt-5 pb-2">
        <Text className="text-gray-500 font-inter-semibold text-xs uppercase">
          Presupuestos por categoria
        </Text>
      </View>

      {items.length === 0 ? (
        <View className="mx-4 mt-2 rounded-2xl bg-white p-6">
          <Text className="text-center text-base text-gray-700 font-inter-medium">
            Aun no hay presupuestos configurados
          </Text>
          <Text className="mt-1 text-center text-sm text-gray-500 font-inter">
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
              <View key={rowId} className="mb-3 rounded-2xl bg-white p-4 shadow-sm">
                <View className="mb-2 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.category_color ?? "#047857" }}
                    />
                    <Text className="text-gray-900 font-inter-semibold">{item.category_name}</Text>
                  </View>
                  <Text className="text-xs text-gray-500 font-inter-medium">
                    {Math.round(item.progress)}%
                  </Text>
                </View>

                <Text className="text-sm text-gray-600 font-inter">
                  {formatCurrency(item.spent, "COP" as CurrencyCode)} / {formatCurrency(item.amount, "COP" as CurrencyCode)}
                </Text>

                <View className="mt-3 h-2 rounded-full bg-gray-200">
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
                      className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-gray-900"
                    />
                    <View className="mt-2 flex-row gap-2">
                      <Pressable
                        className="flex-1 rounded-xl bg-emerald-600 py-2.5 items-center active:bg-emerald-700"
                        onPress={() => handleSave(item)}
                        disabled={isSaving}
                      >
                        <Text className="text-white font-inter-semibold">
                          {isSaving ? "Guardando..." : "Guardar"}
                        </Text>
                      </Pressable>
                      <Pressable
                        className="rounded-xl border border-gray-300 px-4 py-2.5 items-center"
                        onPress={() => {
                          setEditingId(null);
                          setAmountInput("");
                        }}
                        disabled={isSaving}
                      >
                        <Text className="text-gray-700 font-inter-medium">Cancelar</Text>
                      </Pressable>
                      {!!item.id && (
                        <Pressable
                          className="rounded-xl border border-red-200 px-4 py-2.5 items-center"
                          onPress={() => handleDelete(item)}
                          disabled={isSaving}
                        >
                          <Text className="text-red-600 font-inter-medium">Eliminar</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ) : (
                  <Pressable className="mt-3 items-start" onPress={() => beginEdit(item)}>
                    <Text className="text-sm text-emerald-700 font-inter-semibold">
                      {item.id ? "Editar presupuesto" : "Agregar presupuesto"}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
