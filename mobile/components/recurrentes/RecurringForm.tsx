import { useMemo, useState, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Calendar, ChevronDown, ChevronRight } from "lucide-react-native";
import { getDebtPaymentCategoryId, type TransactionDirection } from "@zeta/shared";
import { COLORS } from "../../lib/constants/colors";
import {
  BRASS_BUTTON_CLASS,
  PANEL_INSET_CLASS,
} from "../../lib/constants/styles";
import { formatAmountInput, parseFormattedAmount } from "../../lib/amount";
import { toLocalDateString } from "../../lib/utils/date";
import {
  filterCategoriesByDirection,
  type CategoryRow as RepoCategoryRow,
} from "../../lib/repositories/categories";
import type { AccountRow } from "../../lib/repositories/accounts";
import type { DestinatarioWithCount } from "../../lib/repositories/destinatarios";
import {
  CategoryZonePickerSheet,
  type CategoryRow as PickerCategoryRow,
} from "../transactions/CategoryZonePickerSheet";
import { DestinatarioPicker } from "../transactions/DestinatarioPicker";

const DEBT_ACCOUNT_TYPES = new Set(["CREDIT_CARD", "LOAN"]);

const FREQUENCIES = [
  { value: "ONCE", label: "Una vez" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "BIWEEKLY", label: "Quincenal" },
  { value: "MONTHLY", label: "Mensual" },
  { value: "QUARTERLY", label: "Trimestral" },
  { value: "ANNUAL", label: "Anual" },
] as const;

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
/** "2026-06-15" → "15 jun 2026". TZ-safe string slice. */
function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(d)} ${MESES[Number(m) - 1] ?? ""} ${y}`;
}

export type RecurringFormValues = {
  merchant_name: string;
  direction: TransactionDirection;
  amount: number;
  account_id: string;
  currency_code: string;
  frequency: string;
  start_date: string;
  end_date: string | null;
  category_id: string | null;
  destinatario_id: string | null;
  transfer_source_account_id: string | null;
  description: string | null;
  // Preserved as-is on edit (no UI — the generator anchors on start_date, but
  // we round-trip them rather than null an existing value).
  day_of_month: number | null;
  day_of_week: number | null;
};

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <Text className="mb-1.5 text-[13px] font-inter-semibold text-foreground">
      {children}
    </Text>
  );
}

/** Inline selector row that opens to a vertical list of options. */
function SelectRow<T extends string>({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        className={`${PANEL_INSET_CLASS} flex-row items-center justify-between px-4 py-3`}
      >
        <Text
          className={`text-sm font-inter-medium ${selected ? "text-foreground" : "text-muted-foreground"}`}
          numberOfLines={1}
        >
          {selected?.label ?? placeholder}
        </Text>
        <ChevronDown
          size={16}
          color={COLORS.sageDark}
          style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
        />
      </Pressable>
      {open ? (
        <View className={`${PANEL_INSET_CLASS} mt-1 overflow-hidden`}>
          {options.map((o, i) => {
            const sel = o.value === value;
            return (
              <Pressable
                key={o.value}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: sel }}
                className={`px-4 py-3 active:bg-z-surface-2-80 ${i === 0 ? "" : "border-t border-white-6"} ${sel ? "bg-z-surface-2-80" : ""}`}
              >
                <Text
                  className={`text-sm ${sel ? "font-inter-semibold text-z-brass" : "font-inter-medium text-foreground"}`}
                >
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export function RecurringForm({
  accounts,
  categories,
  destinatarios,
  initial,
  submitLabel,
  saving,
  onSubmit,
}: {
  accounts: AccountRow[];
  categories: RepoCategoryRow[];
  destinatarios: DestinatarioWithCount[];
  initial?: Partial<RecurringFormValues>;
  submitLabel: string;
  saving: boolean;
  onSubmit: (values: RecurringFormValues) => void;
}) {
  const today = toLocalDateString(new Date());

  const [merchantName, setMerchantName] = useState(initial?.merchant_name ?? "");
  const [direction, setDirection] = useState<TransactionDirection>(
    initial?.direction ?? "OUTFLOW"
  );
  const [amountInput, setAmountInput] = useState(
    initial?.amount ? formatAmountInput(String(Math.round(initial.amount))) : ""
  );
  const [accountId, setAccountId] = useState(initial?.account_id ?? "");
  const [frequency, setFrequency] = useState(initial?.frequency ?? "MONTHLY");
  const [startDate, setStartDate] = useState(initial?.start_date ?? today);
  const [endDate, setEndDate] = useState<string | null>(initial?.end_date ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(initial?.category_id ?? null);
  const [categoryName, setCategoryName] = useState<string | null>(() => {
    if (!initial?.category_id) return null;
    const c = categories.find((x) => x.id === initial.category_id);
    return c?.name_es ?? c?.name ?? null;
  });
  const [destinatarioId, setDestinatarioId] = useState<string | null>(initial?.destinatario_id ?? null);
  const [destinatarioName, setDestinatarioName] = useState<string | null>(
    () =>
      initial?.destinatario_id
        ? (destinatarios.find((x) => x.id === initial.destinatario_id)?.name ?? null)
        : null
  );
  const [transferSourceId, setTransferSourceId] = useState<string | null>(
    initial?.transfer_source_account_id ?? null
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [error, setError] = useState<string | null>(null);

  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showDestinatarioPicker, setShowDestinatarioPicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === accountId) ?? null;
  const isDebtAccount = !!selectedAccount && DEBT_ACCOUNT_TYPES.has(selectedAccount.account_type);
  const isDebtPayment = isDebtAccount && direction === "INFLOW";
  const currencyCode = selectedAccount?.currency_code ?? initial?.currency_code ?? "COP";

  const filteredCategories = useMemo(
    () => filterCategoriesByDirection(categories, direction),
    [categories, direction]
  );

  function handleSubmit() {
    const amount = parseFormattedAmount(amountInput);
    if (!merchantName.trim()) return setError("El nombre es requerido.");
    if (!accountId) return setError("Selecciona una cuenta.");
    if (!amount || amount <= 0) return setError("El monto debe ser mayor a 0.");
    if (isDebtPayment && !transferSourceId)
      return setError("Selecciona la cuenta origen del pago de deuda.");
    if (frequency !== "ONCE" && endDate && endDate < startDate)
      return setError("La fecha fin no puede ser anterior a la fecha de inicio.");
    setError(null);
    // Mirror the webapp: a debt abono (INFLOW) with no category chosen defaults
    // to the debt-payment category, so it isn't "sin categoría" in the web list.
    const finalCategoryId =
      isDebtPayment && !categoryId && selectedAccount
        ? getDebtPaymentCategoryId(selectedAccount.account_type)
        : categoryId;
    onSubmit({
      merchant_name: merchantName.trim(),
      direction,
      amount,
      account_id: accountId,
      currency_code: currencyCode,
      frequency,
      start_date: startDate,
      end_date: frequency === "ONCE" ? null : endDate,
      category_id: finalCategoryId,
      destinatario_id: destinatarioId,
      transfer_source_account_id: isDebtPayment ? transferSourceId : null,
      description: description.trim() || null,
      day_of_month: initial?.day_of_month ?? null,
      day_of_week: initial?.day_of_week ?? null,
    });
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
    >
      {error ? (
        <View
          accessibilityRole="alert"
          className="mb-3 rounded-xl border border-z-debt-30 bg-z-debt-10 p-3"
        >
          <Text className="text-sm font-inter text-z-debt">{error}</Text>
        </View>
      ) : null}

      <View className="mb-4">
        <FieldLabel>Nombre / Comercio</FieldLabel>
        <View className={`${PANEL_INSET_CLASS} px-4 py-3`}>
          <TextInput
            value={merchantName}
            onChangeText={setMerchantName}
            placeholder="Ej: Netflix, Arriendo, Salario"
            placeholderTextColor={COLORS.sageDark}
            className="text-sm font-inter text-foreground"
          />
        </View>
      </View>

      <View className="mb-4">
        <FieldLabel>Tipo</FieldLabel>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Tipo de movimiento"
          className={`${PANEL_INSET_CLASS} flex-row gap-1 p-1`}
        >
          {(["OUTFLOW", "INFLOW"] as const).map((d) => {
            const sel = d === direction;
            const label =
              d === "OUTFLOW"
                ? isDebtAccount
                  ? "Gasto con tarjeta"
                  : "Gasto"
                : isDebtAccount
                  ? "Abono a deuda"
                  : "Ingreso";
            return (
              <Pressable
                key={d}
                onPress={() => {
                  if (d === direction) return;
                  setDirection(d);
                  // Category is direction-scoped — clear the stale selection.
                  setCategoryId(null);
                  setCategoryName(null);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: sel }}
                className={`flex-1 items-center rounded-lg py-2 ${sel ? "bg-z-surface-2-80" : ""}`}
              >
                <Text
                  className={`text-[13px] font-inter-semibold ${sel ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="mb-4">
        <FieldLabel>Monto ({currencyCode})</FieldLabel>
        <View className={`${PANEL_INSET_CLASS} px-4 py-3`}>
          <TextInput
            value={amountInput}
            onChangeText={(t) => setAmountInput(formatAmountInput(t))}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={COLORS.sageDark}
            className="text-base font-inter-semibold text-foreground"
            style={{ fontVariant: ["tabular-nums"] }}
          />
        </View>
      </View>

      <View className="mb-4">
        <FieldLabel>Cuenta</FieldLabel>
        <SelectRow
          options={accounts.map((a) => ({ value: a.id, label: a.name }))}
          value={accountId || null}
          onChange={(val) => {
            setAccountId(val);
            // A transfer can't be to/from the same account (the repo throws).
            if (val === transferSourceId) setTransferSourceId(null);
          }}
          placeholder="Seleccionar cuenta"
        />
      </View>

      {isDebtPayment ? (
        <View className="mb-4">
          <FieldLabel>Cuenta origen del pago</FieldLabel>
          <SelectRow
            options={accounts
              .filter((a) => a.id !== accountId)
              .map((a) => ({ value: a.id, label: a.name }))}
            value={transferSourceId}
            onChange={setTransferSourceId}
            placeholder="Seleccionar cuenta origen"
          />
        </View>
      ) : null}

      <View className="mb-4">
        <FieldLabel>Frecuencia</FieldLabel>
        <SelectRow
          options={FREQUENCIES.map((f) => ({ value: f.value, label: f.label }))}
          value={frequency}
          onChange={setFrequency}
          placeholder="Frecuencia"
        />
      </View>

      <View className="mb-4">
        <FieldLabel>{frequency === "ONCE" ? "Fecha de pago" : "Fecha de inicio"}</FieldLabel>
        <Pressable
          onPress={() => setShowStartPicker((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showStartPicker }}
          accessibilityLabel={`${frequency === "ONCE" ? "Fecha de pago" : "Fecha de inicio"}: ${fmtDate(startDate)}`}
          className={`${PANEL_INSET_CLASS} flex-row items-center justify-between px-4 py-3`}
        >
          <View className="flex-row items-center gap-2">
            <Calendar size={16} color={COLORS.sageDark} />
            <Text className="text-sm font-inter-medium text-foreground">
              {fmtDate(startDate)}
            </Text>
          </View>
          <ChevronDown
            size={16}
            color={COLORS.sageDark}
            style={{ transform: [{ rotate: showStartPicker ? "180deg" : "0deg" }] }}
          />
        </Pressable>
        {showStartPicker ? (
          <DateTimePicker
            value={new Date(`${startDate}T12:00:00`)}
            mode="date"
            display={Platform.OS === "ios" ? "inline" : "default"}
            themeVariant="dark"
            onChange={(_, d) => {
              if (Platform.OS !== "ios") setShowStartPicker(false);
              if (d) setStartDate(toLocalDateString(d));
            }}
          />
        ) : null}
      </View>

      {frequency !== "ONCE" ? (
        <View className="mb-4">
          <FieldLabel>Fecha fin (opcional)</FieldLabel>
          <Pressable
            onPress={() => setShowEndPicker((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showEndPicker }}
            accessibilityLabel={`Fecha fin: ${endDate ? fmtDate(endDate) : "sin fecha fin"}`}
            className={`${PANEL_INSET_CLASS} flex-row items-center justify-between px-4 py-3`}
          >
            <View className="flex-row items-center gap-2">
              <Calendar size={16} color={COLORS.sageDark} />
              <Text
                className={`text-sm font-inter-medium ${endDate ? "text-foreground" : "text-muted-foreground"}`}
              >
                {endDate ? fmtDate(endDate) : "Sin fecha fin"}
              </Text>
            </View>
            {endDate ? (
              <Pressable onPress={() => setEndDate(null)} hitSlop={8} accessibilityLabel="Quitar fecha fin">
                <Text className="text-xs font-inter-semibold text-z-sage-dark">Quitar</Text>
              </Pressable>
            ) : (
              <ChevronDown
                size={16}
                color={COLORS.sageDark}
                style={{ transform: [{ rotate: showEndPicker ? "180deg" : "0deg" }] }}
              />
            )}
          </Pressable>
          {showEndPicker ? (
            <DateTimePicker
              value={new Date(`${endDate ?? startDate}T12:00:00`)}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              themeVariant="dark"
              minimumDate={new Date(`${startDate}T12:00:00`)}
              onChange={(_, d) => {
                if (Platform.OS !== "ios") setShowEndPicker(false);
                if (d) setEndDate(toLocalDateString(d));
              }}
            />
          ) : null}
        </View>
      ) : null}

      <View className="mb-4">
        <FieldLabel>Categoría</FieldLabel>
        <Pressable
          onPress={() => setShowCategoryPicker(true)}
          accessibilityRole="button"
          accessibilityLabel="Elegir categoría"
          className={`${PANEL_INSET_CLASS} flex-row items-center justify-between px-4 py-3`}
        >
          <Text
            className={`text-sm font-inter-medium ${categoryName ? "text-foreground" : "text-muted-foreground"}`}
          >
            {categoryName ?? "Elegir categoría"}
          </Text>
          <ChevronRight size={16} color={COLORS.sageDark} />
        </Pressable>
      </View>

      <View className="mb-4">
        <FieldLabel>Destinatario</FieldLabel>
        <Pressable
          onPress={() => setShowDestinatarioPicker(true)}
          accessibilityRole="button"
          accessibilityLabel="Elegir destinatario"
          className={`${PANEL_INSET_CLASS} flex-row items-center justify-between px-4 py-3`}
        >
          <Text
            className={`text-sm font-inter-medium ${destinatarioName ? "text-foreground" : "text-muted-foreground"}`}
          >
            {destinatarioName ?? "Sin destinatario"}
          </Text>
          <ChevronRight size={16} color={COLORS.sageDark} />
        </Pressable>
      </View>

      <View className="mb-5">
        <FieldLabel>Notas</FieldLabel>
        <View className={`${PANEL_INSET_CLASS} px-4 py-3`}>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Nota opcional"
            placeholderTextColor={COLORS.sageDark}
            className="text-sm font-inter text-foreground"
          />
        </View>
      </View>

      <Pressable
        onPress={handleSubmit}
        disabled={saving}
        accessibilityRole="button"
        accessibilityState={{ disabled: saving }}
        className={`${BRASS_BUTTON_CLASS} items-center rounded-xl py-3.5 active:opacity-80`}
        style={saving ? { opacity: 0.6 } : undefined}
      >
        <Text className="text-sm font-inter-bold text-z-ink">
          {saving ? "Guardando..." : submitLabel}
        </Text>
      </Pressable>

      <CategoryZonePickerSheet
        visible={showCategoryPicker}
        onClose={() => setShowCategoryPicker(false)}
        selectedId={categoryId}
        categories={filteredCategories as PickerCategoryRow[]}
        onSelect={(id, name) => {
          setCategoryId(id);
          setCategoryName(name);
        }}
      />
      <DestinatarioPicker
        visible={showDestinatarioPicker}
        onClose={() => setShowDestinatarioPicker(false)}
        selectedId={destinatarioId}
        destinatarios={destinatarios}
        onSelect={(id, name) => {
          setDestinatarioId(id);
          setDestinatarioName(name);
        }}
      />
    </ScrollView>
  );
}
