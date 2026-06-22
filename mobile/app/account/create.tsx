import {
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
import { AccountTypeGrid } from "../../components/accounts/AccountTypeGrid";
import { ColorPicker } from "../../components/accounts/ColorPicker";
import { CurrencyPicker } from "../../components/accounts/CurrencyPicker";
import {
  DayPicker,
  FormField,
  NumericInput,
} from "../../components/accounts/AccountFormFields";
import { MobileHeader } from "../../components/ui/MobileHeader";
import { createAccount } from "../../lib/repositories/accounts";
import { useAuth } from "../../lib/auth";
import { setPdfPasswordForAccount } from "../../lib/pdf-passwords";
import { COLORS } from "../../lib/constants/colors";
import {
  BRASS_BUTTON_CLASS,
  FORM_INPUT_CLASS,
} from "../../lib/constants/styles";

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

  // PDF import
  const [pdfPassword, setPdfPassword] = useState("");

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
      Alert.alert("Error", "El límite de crédito es requerido para tarjetas.");
      return;
    }

    setSaving(true);
    try {
      const accountId = await createAccount({
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
      await setPdfPasswordForAccount(
        session.user.id,
        accountId,
        pdfPassword.trim() || null
      );
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
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <MobileHeader variant="sub" title="Nueva cuenta" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
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
            className={FORM_INPUT_CLASS}
            value={name}
            onChangeText={setName}
            placeholder="Ej: Bancolombia Ahorros"
            placeholderTextColor={COLORS.sageDark}
            autoCapitalize="words"
          />
        </FormField>

        {/* Institution */}
        <FormField label="Entidad financiera">
          <TextInput
            className={FORM_INPUT_CLASS}
            value={institution}
            onChangeText={setInstitution}
            placeholder="Ej: Bancolombia"
            placeholderTextColor={COLORS.sageDark}
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
            <FormField label="Límite de crédito" required>
              <NumericInput
                value={creditLimit}
                onChangeText={setCreditLimit}
                placeholder="Ej: 5000000"
              />
            </FormField>
            <FormField label="Tasa de interés mensual (%)">
              <NumericInput
                value={interestRate}
                onChangeText={setInterestRate}
                placeholder="Ej: 2.5"
              />
            </FormField>
            <FormField label="Día de corte">
              <DayPicker
                value={cutoffDay}
                onSelect={setCutoffDay}
              />
            </FormField>
            <FormField label="Día de pago">
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
            <FormField label="Tasa de interés mensual (%)">
              <NumericInput
                value={interestRate}
                onChangeText={setInterestRate}
                placeholder="Ej: 1.8"
              />
            </FormField>
            <FormField label="Día de pago">
              <DayPicker
                value={paymentDay}
                onSelect={setPaymentDay}
              />
            </FormField>
          </>
        )}

        {/* PDF password */}
        <FormField label="Contraseña del extracto PDF">
          <TextInput
            className={FORM_INPUT_CLASS}
            value={pdfPassword}
            onChangeText={setPdfPassword}
            placeholder="Si los PDFs de esta cuenta tienen clave"
            placeholderTextColor={COLORS.sageDark}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            importantForAutofill="no"
            textContentType="none"
          />
          <Text className="mt-1.5 text-xs font-inter text-muted-foreground">
            Se sugiere automáticamente al importar extractos de esta cuenta.
          </Text>
        </FormField>

        {/* Color */}
        <FormField label="Color">
          <ColorPicker selected={color} onSelect={setColor} />
        </FormField>

        {/* Submit */}
        <Pressable
          className={`${BRASS_BUTTON_CLASS} rounded-xl py-4 items-center mt-2 ${
            saving ? "opacity-50" : "active:bg-z-brass-80"
          }`}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Crear cuenta"
          accessibilityState={{ disabled: saving }}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.ink} />
          ) : (
            <Text className="text-z-ink font-inter-bold text-base">
              Crear cuenta
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
