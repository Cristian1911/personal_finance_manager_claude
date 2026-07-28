import { Check, ChevronDown } from "lucide-react-native";
import { Pressable, Text, TextInput, View } from "react-native";
import type { AccountRow } from "../../lib/repositories/accounts";
import { COLORS } from "../../lib/constants/colors";
import { PANEL_INSET_CLASS } from "../../lib/constants/styles";

/**
 * Shared building blocks for the account action sheets (Pagar / Transferir /
 * Ajustar). Mirror PaymentSheet.tsx's source-picker + amount-input patterns so
 * every sheet looks and behaves identically.
 */

/** Section eyebrow label used inside the sheets. */
export function SheetFieldLabel({ children }: { children: string }) {
  return (
    <Text className="text-xs font-inter-semibold text-muted-foreground mb-2 uppercase tracking-wider">
      {children}
    </Text>
  );
}

/** Localized amount text input — mirrors PaymentSheet's custom-amount field. */
export function SheetAmountInput({
  value,
  onChangeText,
  autoFocus,
  placeholder = "Ej: 150.000",
}: {
  value: string;
  onChangeText: (next: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  return (
    <TextInput
      className="rounded-xl border border-white-6 bg-black-10 px-3 py-2.5 text-sm font-inter-medium text-foreground"
      placeholderTextColor={COLORS.sageDark}
      placeholder={placeholder}
      keyboardType="numeric"
      value={value}
      onChangeText={onChangeText}
      autoFocus={autoFocus}
    />
  );
}

/**
 * Collapsible account picker — mirrors PaymentSheet's source-account accordion.
 * `accounts` is the already-filtered list of selectable accounts.
 */
export function SheetAccountPicker({
  accounts,
  selectedId,
  onSelect,
  open,
  onToggle,
  placeholder = "Seleccionar cuenta",
}: {
  accounts: AccountRow[];
  selectedId: string;
  onSelect: (id: string) => void;
  open: boolean;
  onToggle: () => void;
  placeholder?: string;
}) {
  const selected = accounts.find((a) => a.id === selectedId);
  return (
    <>
      <Pressable
        onPress={onToggle}
        className={`${PANEL_INSET_CLASS} flex-row items-center justify-between px-3 py-2.5 mb-1`}
      >
        <Text className="text-sm font-inter-medium text-foreground" numberOfLines={1}>
          {selected?.name ?? placeholder}
        </Text>
        <ChevronDown
          size={14}
          color={COLORS.sageDark}
          style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
        />
      </Pressable>

      {open && (
        <View className={`${PANEL_INSET_CLASS} overflow-hidden mb-3`}>
          {accounts.map((acc, i) => (
            <Pressable
              key={acc.id}
              onPress={() => onSelect(acc.id)}
              className={`flex-row items-center justify-between px-3 py-2.5 active:bg-white-5 ${
                i > 0 ? "border-t border-white-6" : ""
              }`}
            >
              <Text className="text-[13px] font-inter-medium text-foreground" numberOfLines={1}>
                {acc.name}
              </Text>
              {acc.id === selectedId && <Check size={14} color={COLORS.income} />}
            </Pressable>
          ))}
          {accounts.length === 0 && (
            <View className="px-3 py-3">
              <Text className="text-[12px] font-inter text-muted-foreground">
                No hay cuentas disponibles
              </Text>
            </View>
          )}
        </View>
      )}
    </>
  );
}

/** Inline error banner — mirrors PaymentSheet's error surface. */
export function SheetError({ message }: { message: string }) {
  return (
    <View className="rounded-xl bg-z-debt-10 px-3 py-2 mb-2">
      <Text className="text-xs font-inter-medium text-z-debt">{message}</Text>
    </View>
  );
}
