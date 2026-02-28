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
import * as SecureStore from "expo-secure-store";
import { autoCategorize, parseQuickCaptureText, type TransactionDirection } from "@venti5/shared";
import { KeyboardScreen } from "../components/common/KeyboardScreen";
import { CategoryPicker, type CategoryRow as PickerCategoryRow } from "../components/transactions/CategoryPicker";
import { parseLocalizedAmount } from "../lib/amount";
import { useAuth } from "../lib/auth";
import { getAllAccounts, type AccountRow } from "../lib/repositories/accounts";
import { getAllCategories, type CategoryRow } from "../lib/repositories/categories";
import {
  createQuickCaptureTransaction,
  createTransaction,
} from "../lib/repositories/transactions";

const DEFAULT_ACCOUNT_KEY = "venti5:last_capture_account_id";

type Mode = "quick" | "manual";

export default function CaptureScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [mode, setMode] = useState<Mode>("quick");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const [accountId, setAccountId] = useState("");
  const [direction, setDirection] = useState<TransactionDirection>("OUTFLOW");
  const [amountInput, setAmountInput] = useState("");
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [quickInput, setQuickInput] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const [accountRows, categoryRows, storedAccountId] = await Promise.all([
            getAllAccounts(),
            getAllCategories(),
            SecureStore.getItemAsync(DEFAULT_ACCOUNT_KEY),
          ]);
          if (!active) return;
          setAccounts(accountRows);
          setCategories(categoryRows);
          const fallbackAccountId =
            storedAccountId && accountRows.some((row) => row.id === storedAccountId)
              ? storedAccountId
              : accountRows[0]?.id ?? "";
          setAccountId(fallbackAccountId);
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId) ?? null,
    [accounts, accountId]
  );

  function applyQuickParse() {
    const parsed = parseQuickCaptureText(quickInput);
    if (!parsed.success) {
      Alert.alert("No entendí el movimiento", parsed.error);
      return;
    }

    const suggestedCategory = autoCategorize(parsed.data.merchant_name)?.category_id ?? null;
    const suggestedCategoryRow = categories.find((item) => item.id === suggestedCategory) ?? null;
    setDirection(parsed.data.direction);
    setAmountInput(String(parsed.data.amount));
    setTransactionDate(parsed.data.transaction_date);
    setDescription(parsed.data.merchant_name);
    setNotes("");
    setCategoryId(suggestedCategory);
    setCategoryName(suggestedCategoryRow?.name_es ?? suggestedCategoryRow?.name ?? null);
  }

  async function handleSave() {
    if (!session?.user?.id) {
      Alert.alert("Requiere cuenta", "Debes iniciar sesión para registrar movimientos.");
      return;
    }
    if (!accountId) {
      Alert.alert("Cuenta requerida", "Selecciona una cuenta para guardar el movimiento.");
      return;
    }

    const parsedAmount = parseLocalizedAmount(amountInput);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Monto inválido", "Ingresa un monto mayor a cero.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Descripción requerida", "Agrega una descripción para el movimiento.");
      return;
    }

    setSaving(true);
    try {
      if (mode === "quick") {
        await createQuickCaptureTransaction({
          user_id: session.user.id,
          account_id: accountId,
          amount: parsedAmount,
          currency_code: selectedAccount?.currency_code ?? "COP",
          direction,
          transaction_date: transactionDate,
          description: description.trim(),
          merchant_name: description.trim(),
          raw_description: quickInput.trim() || description.trim(),
          category_id: categoryId,
          notes: notes.trim() || null,
          capture_input_text: quickInput.trim(),
        });
      } else {
        await createTransaction({
          user_id: session.user.id,
          account_id: accountId,
          amount: parsedAmount,
          currency_code: selectedAccount?.currency_code ?? "COP",
          direction,
          transaction_date: transactionDate,
          description: description.trim(),
          merchant_name: description.trim(),
          raw_description: description.trim(),
          category_id: categoryId,
          notes: notes.trim() || null,
          provider: "MANUAL",
          capture_method: "MANUAL_FORM",
        });
      }

      await SecureStore.setItemAsync(DEFAULT_ACCOUNT_KEY, accountId);
      router.back();
    } catch (error) {
      console.error("Capture save error:", error);
      Alert.alert("Error", "No se pudo guardar el movimiento.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-100">
        <ActivityIndicator size="large" color="#047857" />
      </View>
    );
  }

  return (
    <KeyboardScreen
      title="Registrar movimiento"
      onBack={() => router.back()}
      footer={
        <Pressable
          onPress={handleSave}
          disabled={saving}
          className={`items-center rounded-xl py-3 ${
            saving ? "bg-gray-300" : "bg-primary active:bg-emerald-700"
          }`}
        >
          <Text className="font-inter-bold text-white">
            {saving ? "Guardando..." : "Guardar movimiento"}
          </Text>
        </Pressable>
      }
    >
      <View className="mb-4 flex-row gap-2">
        <Pressable
          onPress={() => setMode("quick")}
          className={`flex-1 rounded-xl px-4 py-3 ${mode === "quick" ? "bg-primary" : "bg-white"}`}
        >
          <Text className={`text-center font-inter-semibold ${mode === "quick" ? "text-white" : "text-gray-700"}`}>
            Texto rápido
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode("manual")}
          className={`flex-1 rounded-xl px-4 py-3 ${mode === "manual" ? "bg-primary" : "bg-white"}`}
        >
          <Text className={`text-center font-inter-semibold ${mode === "manual" ? "text-white" : "text-gray-700"}`}>
            Formulario
          </Text>
        </Pressable>
      </View>

      {mode === "quick" && (
        <View className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <Text className="text-base font-inter-semibold text-gray-900">
            Describe el movimiento como lo harías por chat
          </Text>
          <Text className="mt-1 text-xs font-inter text-gray-500">
            Ej: gasté 15k en café ayer
          </Text>
          <TextInput
            className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900"
            value={quickInput}
            onChangeText={setQuickInput}
            placeholder="Escribe el movimiento..."
            placeholderTextColor="#9CA3AF"
          />
          <Pressable
            onPress={applyQuickParse}
            className="mt-3 items-center rounded-xl bg-gray-900 py-3 active:bg-gray-700"
          >
            <Text className="font-inter-semibold text-white">Interpretar</Text>
          </Pressable>
        </View>
      )}

      <View className="rounded-xl border border-gray-200 bg-white p-4">
        <Text className="mb-3 text-base font-inter-semibold text-gray-900">
          Detalles
        </Text>

        <Text className="mb-1 text-sm font-inter-medium text-gray-700">Cuenta</Text>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {accounts.map((account) => {
            const selected = account.id === accountId;
            return (
              <Pressable
                key={account.id}
                onPress={() => setAccountId(account.id)}
                className={`rounded-full px-3 py-2 ${selected ? "bg-primary" : "bg-gray-100"}`}
              >
                <Text className={`font-inter-medium text-sm ${selected ? "text-white" : "text-gray-700"}`}>
                  {account.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="mb-4 flex-row gap-2">
          {(["OUTFLOW", "INFLOW"] as TransactionDirection[]).map((item) => {
            const selected = item === direction;
            return (
              <Pressable
                key={item}
                onPress={() => setDirection(item)}
                className={`flex-1 rounded-xl px-4 py-3 ${selected ? "bg-primary" : "bg-gray-100"}`}
              >
                <Text className={`text-center font-inter-semibold ${selected ? "text-white" : "text-gray-700"}`}>
                  {item === "OUTFLOW" ? "Gasto" : "Ingreso"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text className="mb-1 text-sm font-inter-medium text-gray-700">Monto</Text>
        <TextInput
          className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900"
          value={amountInput}
          onChangeText={setAmountInput}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor="#9CA3AF"
        />

        <Text className="mb-1 text-sm font-inter-medium text-gray-700">Fecha</Text>
        <TextInput
          className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900"
          value={transactionDate}
          onChangeText={setTransactionDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#9CA3AF"
        />

        <Text className="mb-1 text-sm font-inter-medium text-gray-700">Descripción</Text>
        <TextInput
          className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900"
          value={description}
          onChangeText={setDescription}
          placeholder="Ej: Netflix"
          placeholderTextColor="#9CA3AF"
        />

        <Text className="mb-1 text-sm font-inter-medium text-gray-700">Categoría</Text>
        <Pressable
          onPress={() => setShowCategoryPicker(true)}
          className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
        >
          <Text className="text-sm text-gray-900">
            {categoryName ?? "Seleccionar categoría"}
          </Text>
        </Pressable>

        <Text className="mb-1 text-sm font-inter-medium text-gray-700">Notas</Text>
        <TextInput
          className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900"
          value={notes}
          onChangeText={setNotes}
          placeholder="Opcional"
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <CategoryPicker
        visible={showCategoryPicker}
        onClose={() => setShowCategoryPicker(false)}
        onSelect={(id, name) => {
          setCategoryId(id);
          setCategoryName(name);
        }}
        selectedId={categoryId}
        categories={categories as PickerCategoryRow[]}
      />
    </KeyboardScreen>
  );
}
