import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { X } from "lucide-react-native";
import { AccountTypeGrid } from "../../components/accounts/AccountTypeGrid";
import { ColorPicker } from "../../components/accounts/ColorPicker";
import { CurrencyPicker } from "../../components/accounts/CurrencyPicker";
import { createAccount } from "../../lib/repositories/accounts";
import { useAuth } from "../../lib/auth";

function FormField({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <View className="mb-4">
      <Text className="text-gray-700 font-inter-medium text-sm mb-1.5">
        {label}
        {required && <Text className="text-red-500"> *</Text>}
      </Text>
      {children}
    </View>
  );
}

function NumericInput({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <TextInput
      className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 font-inter text-sm"
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder ?? "0"}
      placeholderTextColor="#9CA3AF"
      keyboardType="decimal-pad"
    />
  );
}

const CREDIT_CARD_DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));

function DayPicker({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (v: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8 }}
    >
      {CREDIT_CARD_DAYS.map((day) => {
        const isSelected = value === day;
        return (
          <Pressable
            key={day}
            className={`w-10 h-10 rounded-full items-center justify-center border-2 ${
              isSelected
                ? "bg-primary border-primary"
                : "bg-white border-gray-200"
            }`}
            onPress={() => onSelect(isSelected ? "" : day)}
          >
            <Text
              className={`font-inter-medium text-sm ${
                isSelected ? "text-white" : "text-gray-700"
              }`}
            >
              {day}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function CreateAccountScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [saving, setSaving] = useState(false);

  // Common fields
  const [accountType, setAccountType] = useState("CHECKING");
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [currency, setCurrency] = useState("COP");
  const [balance, setBalance] = useState("0");
  const [color, setColor] = useState("#6366f1");

  // Credit card fields
  const [creditLimit, setCreditLimit] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [cutoffDay, setCutoffDay] = useState("");
  const [paymentDay, setPaymentDay] = useState("");

  const isCreditCard = accountType === "CREDIT_CARD";
  const isLoan = accountType === "LOAN";

  const handleSave = async () => {
    if (!session?.user?.id) return;

    if (!name.trim()) {
      Alert.alert("Error", "El nombre es requerido.");
      return;
    }

    const parsedBalance = parseFloat(balance) || 0;

    if (isCreditCard && !creditLimit.trim()) {
      Alert.alert("Error", "El limite de credito es requerido para tarjetas.");
      return;
    }

    setSaving(true);
    try {
      await createAccount({
        user_id: session.user.id,
        name: name.trim(),
        account_type: accountType,
        institution_name: institution.trim() || null,
        currency_code: currency,
        current_balance: parsedBalance,
        color,
        credit_limit:
          isCreditCard && creditLimit ? parseFloat(creditLimit) : null,
        interest_rate:
          (isCreditCard || isLoan) && interestRate
            ? parseFloat(interestRate)
            : null,
        cutoff_day:
          isCreditCard && cutoffDay ? parseInt(cutoffDay, 10) : null,
        payment_day:
          (isCreditCard || isLoan) && paymentDay
            ? parseInt(paymentDay, 10)
            : null,
      });
      router.back();
    } catch (error) {
      console.error("Create account error:", error);
      Alert.alert("Error", "No se pudo crear la cuenta.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-2 bg-gray-50">
        <Pressable
          onPress={() => router.canGoBack() ? router.back() : router.navigate("/(tabs)/accounts")}
          className="w-8 h-8 items-center justify-center rounded-full bg-gray-200 active:bg-gray-300"
        >
          <X size={18} color="#6B7280" />
        </Pressable>
        <Text className="text-gray-900 font-inter-bold text-base">
          Nueva cuenta
        </Text>
        <View className="w-8" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Account type */}
        <FormField label="Tipo de cuenta" required>
          <AccountTypeGrid
            selected={accountType}
            onSelect={setAccountType}
          />
        </FormField>

        {/* Name */}
        <FormField label="Nombre" required>
          <TextInput
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 font-inter text-sm"
            value={name}
            onChangeText={setName}
            placeholder="Ej: Bancolombia Ahorros"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="words"
          />
        </FormField>

        {/* Institution */}
        <FormField label="Entidad financiera">
          <TextInput
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-900 font-inter text-sm"
            value={institution}
            onChangeText={setInstitution}
            placeholder="Ej: Bancolombia"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="words"
          />
        </FormField>

        {/* Currency */}
        <FormField label="Moneda">
          <CurrencyPicker selected={currency} onSelect={setCurrency} />
        </FormField>

        {/* Balance */}
        <FormField label="Balance actual" required>
          <NumericInput value={balance} onChangeText={setBalance} />
        </FormField>

        {/* Credit card specific fields */}
        {isCreditCard && (
          <>
            <FormField label="Limite de credito" required>
              <NumericInput
                value={creditLimit}
                onChangeText={setCreditLimit}
                placeholder="Ej: 5000000"
              />
            </FormField>
            <FormField label="Tasa de interes mensual (%)">
              <NumericInput
                value={interestRate}
                onChangeText={setInterestRate}
                placeholder="Ej: 2.5"
              />
            </FormField>
            <FormField label="Dia de corte">
              <DayPicker
                value={cutoffDay}
                onSelect={setCutoffDay}
              />
            </FormField>
            <FormField label="Dia de pago">
              <DayPicker
                value={paymentDay}
                onSelect={setPaymentDay}
              />
            </FormField>
          </>
        )}

        {/* Loan specific fields */}
        {isLoan && (
          <>
            <FormField label="Tasa de interes mensual (%)">
              <NumericInput
                value={interestRate}
                onChangeText={setInterestRate}
                placeholder="Ej: 1.8"
              />
            </FormField>
            <FormField label="Dia de pago">
              <DayPicker
                value={paymentDay}
                onSelect={setPaymentDay}
              />
            </FormField>
          </>
        )}

        {/* Color */}
        <FormField label="Color">
          <ColorPicker selected={color} onSelect={setColor} />
        </FormField>

        {/* Submit */}
        <Pressable
          className={`rounded-xl py-4 items-center mt-2 ${
            saving ? "bg-gray-300" : "bg-primary active:bg-primary-dark"
          }`}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-white font-inter-bold text-base">
              Crear cuenta
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
