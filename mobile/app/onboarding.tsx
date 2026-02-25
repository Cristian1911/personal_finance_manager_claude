import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

const PURPOSES = [
  { id: "manage_debt", label: "Salir de deudas" },
  { id: "track_spending", label: "Entender gastos" },
  { id: "save_money", label: "Ahorrar mejor" },
  { id: "improve_habits", label: "Mejorar habitos" },
];

export default function MobileOnboardingScreen() {
  const router = useRouter();
  const { session } = useAuth();

  const [fullName, setFullName] = useState("");
  const [purpose, setPurpose] = useState(PURPOSES[0].id);
  const [income, setIncome] = useState("");
  const [expenses, setExpenses] = useState("");
  const [accountName, setAccountName] = useState("Cuenta principal");
  const [balance, setBalance] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const incomeNumber = Number(income) || 0;
  const expensesNumber = Number(expenses) || 0;
  const budgetHint = Math.max(incomeNumber - expensesNumber, 0);

  async function handleFinish() {
    if (!session?.user?.id) return;

    setError(null);
    if (!fullName.trim() || !accountName.trim()) {
      setError("Completa tu nombre y una cuenta inicial.");
      return;
    }

    const balanceNumber = Number(balance);
    if (!Number.isFinite(balanceNumber)) {
      setError("Ingresa un saldo inicial valido.");
      return;
    }

    setLoading(true);
    try {
      const now = new Date().toISOString();

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          app_purpose: purpose,
          estimated_monthly_income: incomeNumber || 0,
          estimated_monthly_expenses: expensesNumber || 0,
          preferred_currency: "COP",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Bogota",
          locale: "es-CO",
          onboarding_completed: true,
          updated_at: now,
        })
        .eq("id", session.user.id);

      if (profileError) {
        throw profileError;
      }

      const { error: accountError } = await supabase.from("accounts").insert({
        user_id: session.user.id,
        name: accountName.trim(),
        account_type: "CHECKING",
        current_balance: balanceNumber,
        currency_code: "COP",
        is_active: true,
        display_order: 0,
        provider: "MANUAL",
        connection_status: "CONNECTED",
        created_at: now,
        updated_at: now,
      });

      if (accountError) {
        throw accountError;
      }

      router.replace("/(tabs)");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar el onboarding");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
        <View className="mb-6 rounded-3xl bg-emerald-600 p-5">
          <Text className="text-2xl font-inter-bold text-white">Venti5</Text>
          <Text className="mt-1 text-sm font-inter text-emerald-50">
            Configura tu punto de partida en menos de 2 minutos.
          </Text>
        </View>

        <View className="rounded-2xl bg-white p-4 shadow-sm">
          <Text className="text-base font-inter-semibold text-gray-900">Objetivo principal</Text>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {PURPOSES.map((item) => {
              const selected = purpose === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setPurpose(item.id)}
                  className={`rounded-full border px-3 py-2 ${selected ? "border-emerald-600 bg-emerald-50" : "border-gray-200 bg-white"}`}
                >
                  <Text className={selected ? "text-emerald-700 font-inter-semibold" : "text-gray-700 font-inter-medium"}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
          <Text className="text-base font-inter-semibold text-gray-900">Perfil financiero</Text>

          <Text className="mt-3 mb-1 text-sm font-inter-medium text-gray-700">Nombre</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Ej: Maria Perez"
            className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-gray-900"
          />

          <Text className="mt-3 mb-1 text-sm font-inter-medium text-gray-700">Ingreso mensual estimado</Text>
          <TextInput
            value={income}
            onChangeText={setIncome}
            keyboardType="numeric"
            placeholder="Ej: 5000000"
            className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-gray-900"
          />

          <Text className="mt-3 mb-1 text-sm font-inter-medium text-gray-700">Gasto mensual estimado</Text>
          <TextInput
            value={expenses}
            onChangeText={setExpenses}
            keyboardType="numeric"
            placeholder="Ej: 3800000"
            className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-gray-900"
          />

          <Text className="mt-2 text-xs text-gray-500 font-inter">
            Referencia para presupuestar: {budgetHint.toLocaleString("es-CO")} COP/mes
          </Text>
        </View>

        <View className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
          <Text className="text-base font-inter-semibold text-gray-900">Cuenta inicial</Text>
          <Text className="mt-1 text-xs text-gray-500 font-inter">
            Puedes cambiarla o agregar mas cuentas despues.
          </Text>

          <Text className="mt-3 mb-1 text-sm font-inter-medium text-gray-700">Nombre de la cuenta</Text>
          <TextInput
            value={accountName}
            onChangeText={setAccountName}
            placeholder="Cuenta principal"
            className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-gray-900"
          />

          <Text className="mt-3 mb-1 text-sm font-inter-medium text-gray-700">Saldo actual</Text>
          <TextInput
            value={balance}
            onChangeText={setBalance}
            keyboardType="numeric"
            placeholder="Ej: 1200000"
            className="rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-gray-900"
          />
        </View>

        {error && (
          <View className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
            <Text className="text-sm text-red-700 font-inter">{error}</Text>
          </View>
        )}

        <Pressable
          className={`mt-5 rounded-xl py-3.5 items-center ${loading ? "bg-emerald-400" : "bg-emerald-600"}`}
          onPress={handleFinish}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-inter-bold text-base">Entrar a Venti5</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
