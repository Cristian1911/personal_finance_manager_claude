import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Calendar,
  ChevronDown,
  ChevronRight,
  Repeat,
} from "lucide-react-native";
import {
  autoCategorize,
  CATEGORY_INGRESOS,
  CATEGORY_OTROS_INGRESOS,
  formatCurrency,
  formatDate,
  type CurrencyCode,
  type TransactionDirection,
} from "@zeta/shared";
import {
  CategoryZonePickerSheet,
  type CategoryRow as PickerCategoryRow,
} from "../components/transactions/CategoryZonePickerSheet";
import { parseLocalizedAmount } from "../lib/amount";
import { useAuth } from "../lib/auth";
import { getAllAccounts, type AccountRow } from "../lib/repositories/accounts";
import {
  getAllCategories,
  type CategoryRow,
} from "../lib/repositories/categories";
import { createTransaction } from "../lib/repositories/transactions";
import { toLocalDateString } from "../lib/utils/date";
import {
  PANEL_INSET_CLASS,
} from "../lib/constants/styles";
import { COLORS } from "../lib/constants/colors";

const DEFAULT_ACCOUNT_KEY = "zeta.last_capture_account_id";
const EXPLICIT_DEFAULT_ACCOUNT_KEY = "zeta.default_capture_account_id";
const INCOME_PARENT_IDS = new Set([CATEGORY_INGRESOS, CATEGORY_OTROS_INGRESOS]);

type TxType = "expense" | "income" | "transfer";

const TX_OPTIONS: Array<{
  id: TxType;
  label: string;
  icon: typeof ArrowUpRight;
}> = [
  { id: "expense", label: "Gasto", icon: ArrowUpRight },
  { id: "income", label: "Ingreso", icon: ArrowDownLeft },
  { id: "transfer", label: "Transferencia", icon: ArrowLeftRight },
];

function isIncomeCategory(cat: CategoryRow): boolean {
  if (INCOME_PARENT_IDS.has(cat.id)) return true;
  if (cat.parent_id && INCOME_PARENT_IDS.has(cat.parent_id)) return true;
  return false;
}

function filterCategoriesByDirection(
  cats: CategoryRow[],
  direction: TransactionDirection
): CategoryRow[] {
  if (direction === "INFLOW") return cats.filter(isIncomeCategory);
  return cats.filter((c) => !isIncomeCategory(c));
}

function TypePills({
  value,
  onChange,
}: {
  value: TxType;
  onChange: (next: TxType) => void;
}) {
  return (
    <View className={`${PANEL_INSET_CLASS} flex-row p-1 gap-1`}>
      {TX_OPTIONS.map((opt) => {
        const selected = opt.id === value;
        const Icon = opt.icon;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-lg py-2 ${
              selected ? "bg-z-surface-2-80" : ""
            }`}
          >
            <Icon
              size={14}
              color={selected ? COLORS.foreground : COLORS.sageDark}
            />
            <Text
              className={`text-[13px] font-inter-semibold ${
                selected ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <Text className="mb-1.5 text-[13px] font-inter-semibold text-foreground">
      {children}
    </Text>
  );
}

function AccountAccordion({
  accounts,
  selectedId,
  onSelect,
}: {
  accounts: AccountRow[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = accounts.find((a) => a.id === selectedId);

  return (
    <View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        className={`${PANEL_INSET_CLASS} flex-row items-center justify-between px-4 py-3`}
      >
        <Text
          className={`text-sm font-inter-medium ${
            selected ? "text-foreground" : "text-muted-foreground"
          }`}
          numberOfLines={1}
        >
          {selected?.name ?? "Seleccionar cuenta"}
        </Text>
        <ChevronDown
          size={16}
          color={COLORS.sageDark}
          style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
        />
      </Pressable>
      {open && (
        <View className={`${PANEL_INSET_CLASS} mt-2 overflow-hidden`}>
          {accounts.map((acct, idx) => {
            const isSel = acct.id === selectedId;
            return (
              <Pressable
                key={acct.id}
                onPress={() => {
                  onSelect(acct.id);
                  setOpen(false);
                }}
                className={`px-4 py-3 active:bg-black-10 ${
                  idx > 0 ? "border-t border-white-6" : ""
                }`}
              >
                <Text
                  className={`text-sm font-inter-${
                    isSel ? "semibold" : "medium"
                  } ${isSel ? "text-z-brass" : "text-foreground"}`}
                  numberOfLines={1}
                >
                  {acct.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function CaptureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [relatedOpen, setRelatedOpen] = useState(false);

  const [type, setType] = useState<TxType>("expense");
  const [accountId, setAccountId] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [transactionDate, setTransactionDate] = useState(toLocalDateString());
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [isSubscription, setIsSubscription] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const [accountRows, categoryRows, explicitDefault, lastUsed] =
            await Promise.all([
              getAllAccounts(),
              getAllCategories(),
              SecureStore.getItemAsync(EXPLICIT_DEFAULT_ACCOUNT_KEY),
              SecureStore.getItemAsync(DEFAULT_ACCOUNT_KEY),
            ]);
          if (!active) return;
          setAccounts(accountRows);
          setCategories(categoryRows);
          const pick = (id: string | null) =>
            id && accountRows.some((row) => row.id === id) ? id : null;
          const resolved =
            pick(explicitDefault) ??
            pick(lastUsed) ??
            accountRows[0]?.id ??
            "";
          setAccountId(resolved);
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

  const currencyCode: CurrencyCode =
    (selectedAccount?.currency_code as CurrencyCode) ?? "COP";

  const direction: TransactionDirection =
    type === "income" ? "INFLOW" : "OUTFLOW";

  const filteredCategories = useMemo(
    () => filterCategoriesByDirection(categories, direction),
    [categories, direction]
  );

  const parsedAmount = parseLocalizedAmount(amountInput);
  const hasValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const amountToneClass =
    !hasValidAmount
      ? "text-muted-foreground"
      : type === "income"
        ? "text-z-income"
        : type === "transfer"
          ? "text-z-brass"
          : "text-z-expense";

  function handleTypeChange(next: TxType) {
    if (next === "transfer") {
      Alert.alert(
        "Próximamente",
        "La creación de transferencias llega en la siguiente versión."
      );
      return;
    }
    if (next !== type) {
      setCategoryId(null);
      setCategoryName(null);
    }
    setType(next);
  }

  function handleDescriptionBlur() {
    if (!description.trim() || categoryId) return;
    const match = autoCategorize(description.trim());
    if (match) {
      const row = filteredCategories.find((c) => c.id === match.category_id);
      if (row) {
        setCategoryId(row.id);
        setCategoryName(row.name_es ?? row.name);
      }
    }
  }

  async function handleSave() {
    if (!session?.user?.id) {
      Alert.alert(
        "Requiere cuenta",
        "Debes iniciar sesión para registrar movimientos."
      );
      return;
    }
    if (!accountId) {
      Alert.alert(
        "Cuenta requerida",
        "Selecciona una cuenta para guardar el movimiento."
      );
      return;
    }
    if (!hasValidAmount) {
      Alert.alert("Monto inválido", "Ingresa un monto mayor a cero.");
      return;
    }
    if (!description.trim()) {
      Alert.alert(
        "Descripción requerida",
        "Agrega una descripción para el movimiento."
      );
      return;
    }

    setSaving(true);
    try {
      await createTransaction({
        user_id: session.user.id,
        account_id: accountId,
        amount: parsedAmount,
        currency_code: currencyCode,
        direction,
        transaction_date: transactionDate,
        description: description.trim(),
        merchant_name: description.trim(),
        raw_description: description.trim(),
        category_id: categoryId,
        notes: notes.trim() || null,
        provider: "MANUAL",
        capture_method: "MANUAL_FORM",
        is_subscription: isSubscription,
      });

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
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={COLORS.brass} />
      </View>
    );
  }

  const submitLabel =
    type === "transfer"
      ? "Registrar transferencia"
      : type === "income"
        ? "Registrar ingreso"
        : "Registrar gasto";

  const amountPlaceholder = hasValidAmount
    ? null
    : formatCurrency(0, currencyCode);
  const amountDisplay = hasValidAmount
    ? formatCurrency(parsedAmount, currencyCode)
    : "";

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View
        className="flex-row items-center justify-between border-b border-white-6 bg-z-surface-2-55 px-4 pb-2"
        style={{ paddingTop: insets.top + 8 }}
      >
        <Pressable
          onPress={() => router.back()}
          className="h-8 w-8 items-center justify-center rounded-full bg-black-10 active:bg-white/10"
          accessibilityLabel="Volver"
        >
          <ArrowLeft size={16} color={COLORS.sageDark} />
        </Pressable>
        <Text className="text-base font-inter-bold text-foreground">
          Nueva transacción
        </Text>
        <View className="w-8" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Type */}
        <TypePills value={type} onChange={handleTypeChange} />

        {/* Amount (centered) */}
        <View className="py-6">
          <Text className="text-center text-[11px] font-inter-semibold uppercase tracking-[3px] text-muted-foreground">
            {currencyCode}
          </Text>
          <TextInput
            value={amountInput}
            onChangeText={setAmountInput}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={COLORS.sageDark}
            autoFocus
            className={`mt-2 w-full text-center font-inter-bold ${amountToneClass}`}
            style={{
              fontSize: amountInput.length > 9 ? 32 : amountInput.length > 6 ? 40 : 48,
              paddingVertical: 4,
              paddingHorizontal: 16,
            }}
          />
          {hasValidAmount && (
            <Text className="mt-1 text-xs font-inter text-z-sage-dark">
              {amountDisplay}
              {amountPlaceholder ? ` · ${amountPlaceholder}` : ""}
            </Text>
          )}
        </View>

        {/* Description */}
        <View className="mb-4">
          <FieldLabel>Descripción</FieldLabel>
          <View className={`${PANEL_INSET_CLASS} px-4 py-3`}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              onBlur={handleDescriptionBlur}
              placeholder="Ej: Almuerzo, Uber, Arriendo…"
              placeholderTextColor={COLORS.sageDark}
              className="text-sm font-inter text-foreground"
              returnKeyType="next"
            />
          </View>
        </View>

        {/* Account */}
        <View className="mb-4">
          <FieldLabel>Cuenta</FieldLabel>
          <AccountAccordion
            accounts={accounts}
            selectedId={accountId}
            onSelect={setAccountId}
          />
        </View>

        {/* Category */}
        <View className="mb-4">
          <FieldLabel>Categoría</FieldLabel>
          <Pressable
            onPress={() => setShowCategoryPicker(true)}
            className={`${PANEL_INSET_CLASS} flex-row items-center justify-between px-4 py-3`}
          >
            <Text
              className={`text-sm font-inter-medium ${
                categoryName ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {categoryName ?? "Elegir categoría"}
            </Text>
            <ChevronRight size={16} color={COLORS.sageDark} />
          </Pressable>
        </View>

        {/* Date */}
        <View className="mb-4">
          <FieldLabel>Fecha</FieldLabel>
          <Pressable
            onPress={() => setShowDatePicker((v) => !v)}
            className={`${PANEL_INSET_CLASS} flex-row items-center justify-between px-4 py-3`}
          >
            <View className="flex-row items-center gap-2">
              <Calendar size={16} color={COLORS.sageDark} />
              <Text className="text-sm font-inter-medium text-foreground">
                {formatDate(transactionDate, "dd MMM yyyy")}
              </Text>
            </View>
            <ChevronDown
              size={16}
              color={COLORS.sageDark}
              style={{ transform: [{ rotate: showDatePicker ? "180deg" : "0deg" }] }}
            />
          </Pressable>
          {showDatePicker && (
            <DateTimePicker
              value={new Date(`${transactionDate}T12:00:00`)}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              maximumDate={new Date()}
              themeVariant="dark"
              accentColor={COLORS.brass}
              onChange={(_event, selected) => {
                setShowDatePicker(false);
                if (selected) setTransactionDate(toLocalDateString(selected));
              }}
            />
          )}
        </View>

        {/* is_subscription */}
        <View className="mb-4">
          <View
            className={`${PANEL_INSET_CLASS} flex-row items-center gap-3 px-4 py-3`}
          >
            <Repeat size={18} color={COLORS.sageDark} />
            <View className="flex-1">
              <Text className="text-sm font-inter-medium text-foreground">
                Es una suscripción
              </Text>
              <Text className="mt-0.5 text-[11px] font-inter text-muted-foreground">
                Marca este movimiento como parte de una suscripción
              </Text>
            </View>
            <Switch
              value={isSubscription}
              onValueChange={setIsSubscription}
              trackColor={{ false: COLORS.switchTrack, true: COLORS.income }}
              thumbColor={COLORS.foreground}
              ios_backgroundColor={COLORS.switchTrack}
            />
          </View>
        </View>

        {/* Opciones relacionadas */}
        <View className="mb-5">
          <Pressable
            onPress={() => setRelatedOpen((v) => !v)}
            className={`${PANEL_INSET_CLASS} flex-row items-center justify-between px-4 py-3`}
          >
            <View className="flex-1 pr-3">
              <Text className="text-sm font-inter-semibold text-foreground">
                Opciones relacionadas
              </Text>
              <Text className="mt-0.5 text-[11px] font-inter text-muted-foreground">
                Expande para crear un destinatario o sembrar este gasto como recurrente.
              </Text>
            </View>
            <ChevronDown
              size={16}
              color={COLORS.sageDark}
              style={{ transform: [{ rotate: relatedOpen ? "180deg" : "0deg" }] }}
            />
          </Pressable>
          {relatedOpen && (
            <View
              className={`${PANEL_INSET_CLASS} mt-2 px-4 py-4 gap-4`}
            >
              <Pressable
                onPress={() =>
                  Alert.alert(
                    "Próximamente",
                    "Crear destinatario desde esta pantalla llega pronto."
                  )
                }
                className="flex-row items-start gap-3 active:opacity-70"
              >
                <View className="flex-1">
                  <Text className="text-sm font-inter-semibold text-foreground">
                    Crear destinatario
                  </Text>
                  <Text className="mt-0.5 text-[11px] font-inter text-muted-foreground">
                    Guarda este comercio para reconocerlo más rápido la próxima vez.
                  </Text>
                </View>
                <ChevronRight size={16} color={COLORS.sageDark} />
              </Pressable>

              <View className="h-px bg-white-6" />

              <Pressable
                onPress={() =>
                  Alert.alert(
                    "Próximamente",
                    "Crear pago recurrente desde esta pantalla llega pronto."
                  )
                }
                className="flex-row items-start gap-3 active:opacity-70"
              >
                <View className="flex-1">
                  <Text className="text-sm font-inter-semibold text-foreground">
                    Crear pago recurrente
                  </Text>
                  <Text className="mt-0.5 text-[11px] font-inter text-muted-foreground">
                    Útil si este movimiento se repite cada semana, mes o trimestre.
                  </Text>
                </View>
                <ChevronRight size={16} color={COLORS.sageDark} />
              </Pressable>
            </View>
          )}
        </View>

        {/* Notes */}
        <View className="mb-6">
          <FieldLabel>Notas (opcional)</FieldLabel>
          <View className={`${PANEL_INSET_CLASS} px-4 py-3`}>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Detalle extra"
              placeholderTextColor={COLORS.sageDark}
              className="text-sm font-inter text-foreground"
              multiline
            />
          </View>
        </View>

        {/* Submit */}
        <Pressable
          onPress={handleSave}
          disabled={saving}
          className={`items-center rounded-xl py-3.5 ${
            saving ? "bg-z-brass-20" : "bg-z-brass active:bg-z-brass-80"
          }`}
        >
          <Text
            className={`text-base font-inter-bold ${
              saving ? "text-z-sage-dark" : "text-z-ink"
            }`}
          >
            {saving ? "Guardando…" : submitLabel}
          </Text>
        </Pressable>
      </ScrollView>

      <CategoryZonePickerSheet
        visible={showCategoryPicker}
        onClose={() => setShowCategoryPicker(false)}
        onSelect={(id, name) => {
          setCategoryId(id);
          setCategoryName(name);
        }}
        selectedId={categoryId}
        categories={filteredCategories as PickerCategoryRow[]}
      />
    </View>
  );
}
