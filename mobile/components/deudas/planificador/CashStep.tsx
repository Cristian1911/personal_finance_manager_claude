import { memo, useCallback, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, Switch } from "react-native";
import * as Crypto from "expo-crypto";
import {
  formatCurrency,
  type CashEntry,
  type CurrencyCode,
} from "@zeta/shared";
import { CalendarPlus, DollarSign, Plus, Repeat, Trash2 } from "lucide-react-native";
import { COLORS } from "../../../lib/constants/colors";
import {
  BRASS_BUTTON_CLASS,
  FORM_INPUT_CLASS,
  GHOST_BUTTON_CLASS,
  PANEL_INSET_CLASS,
} from "../../../lib/constants/styles";
import { MCard } from "../../ui/MCard";
import type { DebtAccountInfo } from "../../../lib/repositories/debt";
import type { PlannerAction } from "./reducer";
import { formatCalendarMonth, getNextMonth, SPANISH_MONTHS_SHORT } from "./utils";

interface Props {
  accounts: DebtAccountInfo[];
  cashEntries: CashEntry[];
  currency: CurrencyCode;
  dispatch: React.Dispatch<PlannerAction>;
}

interface FormState {
  amount: string;
  month: string;
  label: string;
  recurring: boolean;
  recurringMonths: string;
}

const defaultForm = (): FormState => ({
  amount: "",
  month: getNextMonth(),
  label: "",
  recurring: false,
  recurringMonths: "3",
});

export const CashStep = memo(function CashStep({
  accounts,
  cashEntries,
  currency,
  dispatch,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm);

  const totalDebt = useMemo(
    () => accounts.reduce((s, a) => s + a.balance, 0),
    [accounts]
  );
  const totalCash = useMemo(
    () => cashEntries.reduce((s, e) => s + e.amount, 0),
    [cashEntries]
  );

  const canSubmit =
    Boolean(form.amount) &&
    !Number.isNaN(parseFloat(form.amount)) &&
    parseFloat(form.amount) > 0 &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(form.month);

  const handleAdd = useCallback(() => {
    const amount = parseFloat(form.amount);
    if (!canSubmit || amount <= 0) return;
    const months = parseInt(form.recurringMonths, 10);
    const entry: CashEntry = {
      id: Crypto.randomUUID(),
      amount,
      month: form.month,
      currency,
      label: form.label.trim() || undefined,
      ...(form.recurring && months > 1 ? { recurring: { months } } : {}),
    };
    dispatch({ type: "ADD_CASH_ENTRY", entry });
    setForm(defaultForm());
    setShowForm(false);
  }, [form, canSubmit, currency, dispatch]);

  return (
    <View className="gap-3">
      <MCard className="gap-2">
        <View className="flex-row items-center gap-2">
          <DollarSign size={16} color={COLORS.brass} />
          <Text className="text-[13px] font-inter text-muted-foreground">
            Deuda total
          </Text>
          <Text className="text-[13px] font-inter-semibold text-foreground">
            {formatCurrency(totalDebt, currency)}
          </Text>
          <Text className="text-[12px] font-inter text-muted-foreground ml-auto">
            {accounts.length} {accounts.length === 1 ? "deuda" : "deudas"}
          </Text>
        </View>
        {cashEntries.length > 0 && (
          <View className="flex-row items-center justify-between">
            <Text className="text-[12px] font-inter text-muted-foreground">
              Efectivo planeado
            </Text>
            <Text className="text-[13px] font-inter-semibold text-z-income">
              {formatCurrency(totalCash, currency)}
            </Text>
          </View>
        )}
      </MCard>

      {!showForm ? (
        <Pressable
          onPress={() => setShowForm(true)}
          className={`${PANEL_INSET_CLASS} flex-row items-center justify-center gap-2 px-4 py-3`}
        >
          <Plus size={16} color={COLORS.brass} />
          <Text className="text-[13px] font-inter-semibold text-z-brass">
            Agregar efectivo
          </Text>
        </Pressable>
      ) : (
        <CashEntryForm
          form={form}
          setForm={setForm}
          canSubmit={canSubmit}
          onSubmit={handleAdd}
          onCancel={() => {
            setForm(defaultForm());
            setShowForm(false);
          }}
        />
      )}

      {cashEntries.length > 0 ? (
        <View className="gap-2">
          {cashEntries.map((entry) => (
            <CashEntryRow
              key={entry.id}
              entry={entry}
              onRemove={() =>
                dispatch({ type: "REMOVE_CASH_ENTRY", id: entry.id })
              }
            />
          ))}
        </View>
      ) : (
        !showForm && (
          <View className="items-center py-6">
            <CalendarPlus size={28} color={COLORS.sageDark} />
            <Text className="mt-2 text-[12px] font-inter text-muted-foreground text-center">
              Agrega efectivo extra (primas, bonos, ahorros) que planeas usar para
              acelerar el pago de deudas.
            </Text>
          </View>
        )
      )}
    </View>
  );
});

interface CashEntryRowProps {
  entry: CashEntry;
  onRemove: () => void;
}

const CashEntryRow = memo(function CashEntryRow({
  entry,
  onRemove,
}: CashEntryRowProps) {
  return (
    <View className={`${PANEL_INSET_CLASS} flex-row items-center justify-between p-3`}>
      <View className="flex-1 min-w-0">
        <View className="flex-row items-baseline gap-2">
          <Text className="text-[15px] font-inter-semibold text-foreground">
            {formatCurrency(entry.amount, entry.currency)}
          </Text>
          <Text className="text-[11px] font-inter text-muted-foreground">
            {formatCalendarMonth(entry.month)}
          </Text>
        </View>
        <View className="flex-row items-center gap-2 mt-0.5">
          {entry.label ? (
            <Text
              className="text-[11px] font-inter text-muted-foreground flex-1"
              numberOfLines={1}
            >
              {entry.label}
            </Text>
          ) : (
            <Text className="text-[11px] font-inter italic text-muted-foreground/70">
              sin etiqueta
            </Text>
          )}
          {entry.recurring ? (
            <View className="flex-row items-center gap-1 rounded-full bg-z-brass/10 px-2 py-0.5">
              <Repeat size={9} color={COLORS.brass} />
              <Text className="text-[10px] font-inter-semibold text-z-brass">
                {entry.recurring.months} meses
              </Text>
            </View>
          ) : (
            <View className="rounded-full border border-white-6 px-2 py-0.5">
              <Text className="text-[10px] font-inter text-muted-foreground">
                Una vez
              </Text>
            </View>
          )}
        </View>
      </View>
      <Pressable onPress={onRemove} hitSlop={10} className="ml-2 p-1">
        <Trash2 size={16} color={COLORS.expense} />
      </Pressable>
    </View>
  );
});

interface CashEntryFormProps {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  canSubmit: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

function CashEntryForm({
  form,
  setForm,
  canSubmit,
  onSubmit,
  onCancel,
}: CashEntryFormProps) {
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  return (
    <View className="rounded-2xl border border-dashed border-white-8 bg-z-surface-2 p-3 gap-3">
      <View className="flex-row items-center gap-2">
        <CalendarPlus size={14} color={COLORS.brass} />
        <Text className="text-[13px] font-inter-semibold text-foreground">
          Nuevo efectivo extra
        </Text>
      </View>

      <View className="gap-1">
        <Text className="text-[11px] font-inter text-muted-foreground">Monto</Text>
        <TextInput
          className={FORM_INPUT_CLASS}
          placeholder="500.000"
          placeholderTextColor={COLORS.sageDark}
          value={form.amount}
          onChangeText={(v) => setForm((f) => ({ ...f, amount: v }))}
          keyboardType="numeric"
          returnKeyType="done"
        />
      </View>

      <View className="gap-1">
        <Text className="text-[11px] font-inter text-muted-foreground">
          Mes de pago
        </Text>
        <Pressable
          onPress={() => setShowMonthPicker((v) => !v)}
          className={`${FORM_INPUT_CLASS} flex-row items-center justify-between`}
        >
          <Text className="text-[14px] font-inter text-foreground">
            {formatCalendarMonth(form.month)}
          </Text>
          <Text className="text-[11px] font-inter text-muted-foreground">
            {showMonthPicker ? "▲" : "▼"}
          </Text>
        </Pressable>
        {showMonthPicker && (
          <MonthPicker
            value={form.month}
            onChange={(m) => {
              setForm((f) => ({ ...f, month: m }));
              setShowMonthPicker(false);
            }}
          />
        )}
      </View>

      <View className="gap-1">
        <Text className="text-[11px] font-inter text-muted-foreground">
          Etiqueta (opcional)
        </Text>
        <TextInput
          className={FORM_INPUT_CLASS}
          placeholder="Prima de junio, bono fin de año…"
          placeholderTextColor={COLORS.sageDark}
          value={form.label}
          onChangeText={(v) => setForm((f) => ({ ...f, label: v }))}
        />
      </View>

      <View className="flex-row items-center gap-2">
        <Switch
          value={form.recurring}
          onValueChange={(v) => setForm((f) => ({ ...f, recurring: v }))}
          trackColor={{ false: COLORS.sageDark, true: COLORS.brass }}
        />
        <Repeat size={12} color={COLORS.sageDark} />
        <Text className="text-[12px] font-inter text-foreground">
          Repetir mensualmente
        </Text>
      </View>
      {form.recurring && (
        <View className="flex-row items-center gap-2 pl-10">
          <Text className="text-[12px] font-inter text-muted-foreground">
            Número de meses:
          </Text>
          <TextInput
            className={`${FORM_INPUT_CLASS} w-20`}
            value={form.recurringMonths}
            onChangeText={(v) =>
              setForm((f) => ({ ...f, recurringMonths: v.replace(/\D/g, "") }))
            }
            keyboardType="numeric"
            returnKeyType="done"
            maxLength={2}
          />
        </View>
      )}

      <View className="flex-row gap-2 pt-1">
        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit}
          className={`${BRASS_BUTTON_CLASS} flex-1 rounded-xl py-3 items-center ${!canSubmit ? "opacity-50" : ""}`}
        >
          <Text className="text-[13px] font-inter-semibold text-z-ink">
            Agregar
          </Text>
        </Pressable>
        <Pressable
          onPress={onCancel}
          className={`${GHOST_BUTTON_CLASS} rounded-xl px-4 py-3 items-center`}
        >
          <Text className="text-[13px] font-inter-semibold text-foreground">
            Cancelar
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

interface MonthPickerProps {
  value: string;
  onChange: (yyyyMm: string) => void;
}

function MonthPicker({ value, onChange }: MonthPickerProps) {
  const [year, currentMonth] = useMemo(() => {
    const [y, m] = value.split("-");
    return [parseInt(y, 10), parseInt(m, 10)];
  }, [value]);
  const [pickedYear, setPickedYear] = useState(year);

  return (
    <View className={`${PANEL_INSET_CLASS} p-2 gap-2`}>
      <View className="flex-row items-center justify-between px-2">
        <Pressable
          onPress={() => setPickedYear((y) => y - 1)}
          hitSlop={10}
          className="p-1"
        >
          <Text className="text-[16px] font-inter-bold text-foreground">‹</Text>
        </Pressable>
        <Text className="text-[13px] font-inter-semibold text-foreground">
          {pickedYear}
        </Text>
        <Pressable
          onPress={() => setPickedYear((y) => y + 1)}
          hitSlop={10}
          className="p-1"
        >
          <Text className="text-[16px] font-inter-bold text-foreground">›</Text>
        </Pressable>
      </View>
      <View className="flex-row flex-wrap">
        {SPANISH_MONTHS_SHORT.map((m, idx) => {
          const monthNum = idx + 1;
          const yyyyMm = `${pickedYear}-${String(monthNum).padStart(2, "0")}`;
          const selected = pickedYear === year && monthNum === currentMonth;
          return (
            <Pressable
              key={m}
              onPress={() => onChange(yyyyMm)}
              className={`w-1/4 items-center py-2 ${selected ? "bg-z-brass/20 rounded-md" : ""}`}
            >
              <Text
                className={`text-[12px] font-inter-medium ${selected ? "text-z-brass" : "text-foreground"}`}
              >
                {m}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
