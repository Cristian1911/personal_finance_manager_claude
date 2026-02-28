import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Repeat, Trash2 } from "lucide-react-native";
import { formatCurrency, type CurrencyCode, type Database } from "@venti5/shared";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { KeyboardScreen } from "../components/common/KeyboardScreen";

const SUBSCRIPTIONS_CATEGORY_ID = "a0000001-0001-4000-8000-000000000009";
const SUGGESTED_NAMES = [
  "Gym",
  "Netflix",
  "YouTube Premium",
  "Codex",
  "Supabase",
  "Notion",
];

const FREQUENCY_OPTIONS: Array<{
  value: Database["public"]["Enums"]["recurrence_frequency"];
  label: string;
}> = [
  { value: "MONTHLY", label: "Mensual" },
  { value: "ANNUAL", label: "Anual" },
];

type AccountRow = Pick<
  Database["public"]["Tables"]["accounts"]["Row"],
  "id" | "name" | "currency_code" | "is_active"
>;

type RecurringTemplateRow = Pick<
  Database["public"]["Tables"]["recurring_transaction_templates"]["Row"],
  | "id"
  | "account_id"
  | "amount"
  | "currency_code"
  | "frequency"
  | "merchant_name"
  | "description"
  | "day_of_month"
  | "start_date"
  | "is_active"
>;

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getScheduleLabel(template: RecurringTemplateRow): string {
  const day = template.day_of_month ?? 1;
  if (template.frequency === "ANNUAL") {
    return `Anual (día ${day})`;
  }
  return `Mensual (día ${day})`;
}

export default function SubscriptionsScreen() {
  const router = useRouter();
  const { session } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [items, setItems] = useState<RecurringTemplateRow[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [merchantName, setMerchantName] = useState("");
  const [description, setDescription] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [accountId, setAccountId] = useState("");
  const [frequency, setFrequency] =
    useState<Database["public"]["Enums"]["recurrence_frequency"]>("MONTHLY");
  const [dayOfMonthInput, setDayOfMonthInput] = useState(
    String(new Date().getDate())
  );
  const [startDate, setStartDate] = useState(getTodayIsoDate());

  const accountsById = useMemo(() => {
    return new Map(accounts.map((acc) => [acc.id, acc]));
  }, [accounts]);

  const loadData = useCallback(async () => {
    if (!session?.user?.id) {
      setAccounts([]);
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [accountsResult, templatesResult] = await Promise.all([
        supabase
          .from("accounts")
          .select("id, name, currency_code, is_active")
          .eq("user_id", session.user.id)
          .eq("is_active", true)
          .order("name", { ascending: true }),
        supabase
          .from("recurring_transaction_templates")
          .select(
            "id, account_id, amount, currency_code, frequency, merchant_name, description, day_of_month, start_date, is_active"
          )
          .eq("user_id", session.user.id)
          .eq("direction", "OUTFLOW")
          .eq("category_id", SUBSCRIPTIONS_CATEGORY_ID)
          .order("created_at", { ascending: false }),
      ]);

      if (accountsResult.error) throw accountsResult.error;
      if (templatesResult.error) throw templatesResult.error;

      setAccounts((accountsResult.data ?? []) as AccountRow[]);
      setItems((templatesResult.data ?? []) as RecurringTemplateRow[]);
    } catch (error) {
      console.error("Load subscriptions error:", error);
      Alert.alert("Error", "No se pudieron cargar las suscripciones.");
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  function resetForm() {
    setEditingId(null);
    setMerchantName("");
    setDescription("");
    setAmountInput("");
    setAccountId("");
    setFrequency("MONTHLY");
    setDayOfMonthInput(String(new Date().getDate()));
    setStartDate(getTodayIsoDate());
  }

  function beginEdit(item: RecurringTemplateRow) {
    setEditingId(item.id);
    setMerchantName(item.merchant_name ?? "");
    setDescription(item.description ?? "");
    setAmountInput(String(item.amount));
    setAccountId(item.account_id);
    setFrequency(item.frequency);
    setDayOfMonthInput(String(item.day_of_month ?? 1));
    setStartDate(item.start_date);
  }

  function useSuggestedName(name: string) {
    setMerchantName(name);
    if (!description.trim()) {
      setDescription(`Suscripción de ${name}`);
    }
  }

  async function handleSave() {
    if (!session?.user?.id) {
      Alert.alert("Requiere cuenta", "Debes iniciar sesión para guardar suscripciones.");
      return;
    }

    const cleanName = merchantName.trim();
    if (cleanName.length < 2) {
      Alert.alert("Dato faltante", "Ingresa el nombre de la suscripción.");
      return;
    }

    const normalizedAmount = amountInput.replace(",", ".");
    const parsedAmount = Number(normalizedAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Monto inválido", "El monto debe ser mayor a 0.");
      return;
    }

    if (!accountId) {
      Alert.alert("Dato faltante", "Selecciona la cuenta de cobro.");
      return;
    }

    const parsedDay = Number(dayOfMonthInput);
    if (!Number.isInteger(parsedDay) || parsedDay < 1 || parsedDay > 31) {
      Alert.alert("Día inválido", "Ingresa un día entre 1 y 31.");
      return;
    }

    const selectedAccount = accountsById.get(accountId);

    const payload: Database["public"]["Tables"]["recurring_transaction_templates"]["Insert"] = {
      user_id: session.user.id,
      account_id: accountId,
      category_id: SUBSCRIPTIONS_CATEGORY_ID,
      amount: parsedAmount,
      currency_code: selectedAccount?.currency_code ?? "COP",
      direction: "OUTFLOW",
      merchant_name: cleanName,
      description: description.trim() || null,
      frequency,
      day_of_month: parsedDay,
      day_of_week: null,
      start_date: startDate,
      end_date: null,
      is_active: true,
      transfer_source_account_id: null,
    };

    setSaving(true);
    try {
      if (editingId) {
        const current = items.find((item) => item.id === editingId);
        const { error } = await supabase
          .from("recurring_transaction_templates")
          .update({
            account_id: payload.account_id,
            category_id: payload.category_id,
            amount: payload.amount,
            currency_code: payload.currency_code,
            merchant_name: payload.merchant_name,
            description: payload.description,
            frequency: payload.frequency,
            day_of_month: payload.day_of_month,
            start_date: payload.start_date,
            is_active: current?.is_active ?? true,
          })
          .eq("id", editingId)
          .eq("user_id", session.user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("recurring_transaction_templates")
          .insert(payload);
        if (error) throw error;
      }

      resetForm();
      await loadData();
    } catch (error) {
      console.error("Save subscription error:", error);
      Alert.alert("Error", "No se pudo guardar la suscripción.");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(item: RecurringTemplateRow) {
    if (!session?.user?.id) return;

    Alert.alert(
      "Eliminar suscripción",
      `¿Eliminar "${item.merchant_name ?? "Suscripción"}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            setDeletingId(item.id);
            try {
              const { error } = await supabase
                .from("recurring_transaction_templates")
                .delete()
                .eq("id", item.id)
                .eq("user_id", session.user.id);
              if (error) throw error;

              if (editingId === item.id) {
                resetForm();
              }
              await loadData();
            } catch (error) {
              console.error("Delete subscription error:", error);
              Alert.alert("Error", "No se pudo eliminar la suscripción.");
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  }

  async function toggleActive(item: RecurringTemplateRow) {
    if (!session?.user?.id) return;

    const nextValue = !item.is_active;
    setTogglingId(item.id);
    try {
      const { error } = await supabase
        .from("recurring_transaction_templates")
        .update({ is_active: nextValue })
        .eq("id", item.id)
        .eq("user_id", session.user.id);
      if (error) throw error;

      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id ? { ...row, is_active: nextValue } : row
        )
      );
    } catch (error) {
      console.error("Toggle subscription error:", error);
      Alert.alert("Error", "No se pudo actualizar el estado.");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <KeyboardScreen
      title="Suscripciones"
      onBack={() => router.back()}
      footer={
        <View className="flex-row gap-2">
          <Pressable
            onPress={handleSave}
            disabled={saving || loading}
            className={`flex-1 rounded-xl py-3 items-center ${
              saving || loading
                ? "bg-primary-light"
                : "bg-primary active:bg-primary-dark"
            }`}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-white font-inter-bold text-sm">
                {editingId ? "Guardar cambios" : "Agregar suscripción"}
              </Text>
            )}
          </Pressable>

          {editingId ? (
            <Pressable
              onPress={resetForm}
              disabled={saving || loading}
              className="rounded-xl border border-gray-300 px-4 py-3 items-center justify-center"
            >
              <Text className="text-gray-700 font-inter-medium text-sm">Cancelar</Text>
            </Pressable>
          ) : null}
        </View>
      }
    >
      {loading ? (
        <View className="flex-1 items-center justify-center py-16">
          <ActivityIndicator size="large" color="#047857" />
        </View>
      ) : (
        <>
          <View className="rounded-xl border border-gray-200 bg-white p-4">
            <Text className="text-gray-900 font-inter-semibold text-base">
              {editingId ? "Editar suscripción" : "Nueva suscripción"}
            </Text>
            <Text className="text-gray-500 font-inter text-xs mt-1">
              Registra pagos como gym, Netflix, YouTube Premium, Codex, Supabase o Notion.
            </Text>

            <View className="mt-3 flex-row flex-wrap gap-2">
              {SUGGESTED_NAMES.map((name) => (
                <Pressable
                  key={name}
                  onPress={() => useSuggestedName(name)}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 active:bg-emerald-100"
                >
                  <Text className="text-emerald-700 font-inter-medium text-xs">{name}</Text>
                </Pressable>
              ))}
            </View>

            <Text className="mt-4 mb-1 text-sm font-inter-medium text-gray-700">
              Servicio / Membresía
            </Text>
            <TextInput
              value={merchantName}
              onChangeText={setMerchantName}
              placeholder="Ej: Netflix"
              className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-gray-900"
            />

            <Text className="mt-3 mb-1 text-sm font-inter-medium text-gray-700">Monto</Text>
            <TextInput
              value={amountInput}
              onChangeText={setAmountInput}
              keyboardType="decimal-pad"
              placeholder="Ej: 49900"
              className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-gray-900"
            />

            <Text className="mt-3 mb-1 text-sm font-inter-medium text-gray-700">
              Cuenta de cobro
            </Text>
            {accounts.length === 0 ? (
              <View className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                <Text className="text-amber-700 font-inter text-xs">
                  Crea una cuenta primero para registrar suscripciones.
                </Text>
              </View>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {accounts.map((account) => {
                  const selected = accountId === account.id;
                  return (
                    <Pressable
                      key={account.id}
                      onPress={() => setAccountId(account.id)}
                      className={`rounded-xl border px-3 py-2 ${
                        selected
                          ? "border-primary bg-primary-light"
                          : "border-gray-300 bg-white"
                      }`}
                    >
                      <Text
                        className={`font-inter-medium text-xs ${
                          selected ? "text-primary-dark" : "text-gray-700"
                        }`}
                      >
                        {account.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <Text className="mt-3 mb-1 text-sm font-inter-medium text-gray-700">Frecuencia</Text>
            <View className="flex-row gap-2">
              {FREQUENCY_OPTIONS.map((option) => {
                const selected = frequency === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setFrequency(option.value)}
                    className={`rounded-xl border px-3 py-2 ${
                      selected ? "border-primary bg-primary-light" : "border-gray-300 bg-white"
                    }`}
                  >
                    <Text
                      className={`font-inter-medium text-xs ${
                        selected ? "text-primary-dark" : "text-gray-700"
                      }`}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text className="mt-3 mb-1 text-sm font-inter-medium text-gray-700">Día de cobro</Text>
            <TextInput
              value={dayOfMonthInput}
              onChangeText={setDayOfMonthInput}
              keyboardType="number-pad"
              placeholder="1 - 31"
              className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-gray-900"
            />

            <Text className="mt-3 mb-1 text-sm font-inter-medium text-gray-700">
              Nota (opcional)
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Ej: Plan familiar"
              className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-gray-900"
            />

          </View>

          <View className="pt-5 pb-2">
            <Text className="text-gray-500 font-inter-semibold text-xs uppercase">
              Suscripciones registradas
            </Text>
          </View>

          {items.length === 0 ? (
            <View className="rounded-2xl bg-white p-5">
              <Text className="text-center text-sm text-gray-600 font-inter">
                No hay suscripciones todavía.
              </Text>
            </View>
          ) : (
            <View>
              {items.map((item) => {
                const account = accountsById.get(item.account_id);
                const isBusy = togglingId === item.id || deletingId === item.id;
                return (
                  <View key={item.id} className="mb-3 rounded-2xl bg-white p-4 shadow-sm">
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1 pr-3">
                        <Text className="text-gray-900 font-inter-semibold text-base">
                          {item.merchant_name ?? "Suscripción"}
                        </Text>
                        <Text className="text-gray-500 font-inter text-xs mt-1">
                          {account?.name ?? "Cuenta no disponible"}
                        </Text>
                      </View>

                      <View
                        className={`rounded-full px-2.5 py-1 ${
                          item.is_active ? "bg-emerald-100" : "bg-gray-200"
                        }`}
                      >
                        <Text
                          className={`font-inter-medium text-xs ${
                            item.is_active ? "text-emerald-700" : "text-gray-600"
                          }`}
                        >
                          {item.is_active ? "Activa" : "Pausada"}
                        </Text>
                      </View>
                    </View>

                    <View className="mt-3 flex-row items-center justify-between">
                      <Text className="text-gray-900 font-inter-bold text-base">
                        {formatCurrency(item.amount, item.currency_code as CurrencyCode)}
                      </Text>
                      <View className="flex-row items-center">
                        <Repeat size={14} color="#6B7280" />
                        <Text className="ml-1 text-gray-500 font-inter text-xs">
                          {getScheduleLabel(item)}
                        </Text>
                      </View>
                    </View>

                    {item.description ? (
                      <Text className="mt-2 text-gray-500 font-inter text-xs">
                        {item.description}
                      </Text>
                    ) : null}

                    <View className="mt-3 flex-row gap-2">
                      <Pressable
                        onPress={() => beginEdit(item)}
                        className="rounded-xl border border-gray-300 px-3 py-2 active:bg-gray-50"
                        disabled={isBusy || saving}
                      >
                        <Text className="text-gray-700 font-inter-medium text-xs">Editar</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => toggleActive(item)}
                        className="rounded-xl border border-sky-200 px-3 py-2 active:bg-sky-50"
                        disabled={isBusy || saving}
                      >
                        {togglingId === item.id ? (
                          <ActivityIndicator size="small" color="#0284C7" />
                        ) : (
                          <Text className="text-sky-700 font-inter-medium text-xs">
                            {item.is_active ? "Pausar" : "Activar"}
                          </Text>
                        )}
                      </Pressable>

                      <Pressable
                        onPress={() => handleDelete(item)}
                        className="rounded-xl border border-red-200 px-3 py-2 active:bg-red-50"
                        disabled={isBusy || saving}
                      >
                        {deletingId === item.id ? (
                          <ActivityIndicator size="small" color="#DC2626" />
                        ) : (
                          <View className="flex-row items-center">
                            <Trash2 size={12} color="#DC2626" />
                            <Text className="ml-1 text-red-600 font-inter-medium text-xs">
                              Eliminar
                            </Text>
                          </View>
                        )}
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}
    </KeyboardScreen>
  );
}
