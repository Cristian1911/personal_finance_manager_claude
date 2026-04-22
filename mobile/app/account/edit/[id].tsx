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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { AccountTypeGrid } from "../../../components/accounts/AccountTypeGrid";
import { ColorPicker } from "../../../components/accounts/ColorPicker";
import { CurrencyPicker } from "../../../components/accounts/CurrencyPicker";
import {
  DayPicker,
  FormField,
  NumericInput,
} from "../../../components/accounts/AccountFormFields";
import { MobileHeader } from "../../../components/ui/MobileHeader";
import {
  getAccountById,
  updateAccount,
} from "../../../lib/repositories/accounts";
import { useAuth } from "../../../lib/auth";
import {
  getPdfPasswordForAccount,
  setPdfPasswordForAccount,
} from "../../../lib/pdf-passwords";
import { COLORS } from "../../../lib/constants/colors";
import {
  BRASS_BUTTON_CLASS,
  FORM_INPUT_CLASS,
} from "../../../lib/constants/styles";

export default function EditAccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [accountType, setAccountType] = useState("CHECKING");
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [currency, setCurrency] = useState("COP");
  const [balance, setBalance] = useState("0");
  const [color, setColor] = useState("#6366f1");
  const [creditLimit, setCreditLimit] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [cutoffDay, setCutoffDay] = useState("");
  const [paymentDay, setPaymentDay] = useState("");
  const [pdfPassword, setPdfPassword] = useState("");

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const account = await getAccountById(id);
        if (account) {
          setAccountType(account.account_type);
          setName(account.name);
          setInstitution(account.institution_name ?? "");
          setCurrency(account.currency_code);
          setBalance(String(account.current_balance));
          setColor(account.color ?? "#6366f1");
          setCreditLimit(account.credit_limit != null ? String(account.credit_limit) : "");
          setInterestRate(account.interest_rate != null ? String(account.interest_rate) : "");
          setCutoffDay(account.cutoff_day != null ? String(account.cutoff_day) : "");
          setPaymentDay(account.payment_day != null ? String(account.payment_day) : "");
          if (session?.user?.id) {
            const storedPassword = await getPdfPasswordForAccount(
              session.user.id,
              account.id
            );
            setPdfPassword(storedPassword ?? "");
          }
        }
      } catch (error) {
        console.error("Failed to load account:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, session?.user?.id]);

  const isCreditCard = accountType === "CREDIT_CARD";
  const isLoan = accountType === "LOAN";

  const handleSave = async () => {
    if (!id || !session?.user?.id) return;

    if (!name.trim()) {
      Alert.alert("Error", "El nombre es requerido.");
      return;
    }

    if (isCreditCard && !creditLimit.trim()) {
      Alert.alert("Error", "El limite de credito es requerido para tarjetas.");
      return;
    }

    setSaving(true);
    try {
      await updateAccount(id, {
        name: name.trim(),
        account_type: accountType,
        institution_name: institution.trim() || null,
        currency_code: currency,
        current_balance: parseFloat(balance) || 0,
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
        id,
        pdfPassword.trim() || null
      );
      router.back();
    } catch (error) {
      console.error("Update account error:", error);
      Alert.alert("Error", "No se pudo actualizar la cuenta.");
    } finally {
      setSaving(false);
    }
  };

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
      <MobileHeader variant="sub" title="Editar cuenta" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      >
        {/* Account type — disabled in edit mode */}
        <FormField label="Tipo de cuenta">
          <AccountTypeGrid
            selected={accountType}
            onSelect={setAccountType}
            disabled
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

        {/* Credit card specific */}
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
              <DayPicker value={cutoffDay} onSelect={setCutoffDay} />
            </FormField>
            <FormField label="Dia de pago">
              <DayPicker value={paymentDay} onSelect={setPaymentDay} />
            </FormField>
          </>
        )}

        {/* Loan specific */}
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
              <DayPicker value={paymentDay} onSelect={setPaymentDay} />
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
          accessibilityLabel="Guardar cambios"
          accessibilityState={{ disabled: saving }}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.ink} />
          ) : (
            <Text className="text-z-ink font-inter-bold text-base">
              Guardar cambios
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
