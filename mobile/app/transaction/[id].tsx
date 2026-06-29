import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
  TextInput,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { CalendarClock, Calendar, Link2, Pencil, Tag, Trash2, UserRound, X } from "lucide-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  deleteTransaction,
  getTransactionById,
  updateTransaction,
} from "../../lib/repositories/transactions";
import { getAllCategories } from "../../lib/repositories/categories";
import {
  getAllDestinatarios,
  type DestinatarioWithCount,
} from "../../lib/repositories/destinatarios";
import {
  getTagsForTransaction,
  saveTransactionTags,
} from "../../lib/repositories/tags";
import {
  createRecurringTemplate,
  getAccountIdsWithPendingOccurrences,
  getCandidateOccurrencesForTransaction,
  isTransactionLinkedToOccurrence,
  linkExistingTransactionToOccurrence,
  type CandidateOccurrence,
} from "../../lib/repositories/recurring";
import { VincularPicker } from "../../components/transactions/VincularPicker";
import { useAuth } from "../../lib/auth";
import {
  CategoryPicker,
  type CategoryRow,
} from "../../components/transactions/CategoryPicker";
import { DestinatarioPicker } from "../../components/transactions/DestinatarioPicker";
import { TagSelector } from "../../components/transactions/TagSelector";
import { CategoryIcon } from "../../components/ui/CategoryIcon";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import {
  DEBT_PAYMENT_CATEGORY_ID,
  getTransactionTypeLabel,
  isDebtInflow,
} from "../../lib/transaction-semantics";
import { parseLocalizedAmount } from "../../lib/amount";
import { COLORS } from "../../lib/constants/colors";
import { SECTION_EYEBROW_CLASS } from "../../lib/constants/styles";

type TransactionDetail = {
  id: string;
  description: string | null;
  raw_description: string | null;
  merchant_name: string | null;
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  currency_code: string;
  transaction_date: string;
  status: string | null;
  account_id: string;
  category_id: string | null;
  category_name_es: string | null;
  category_color: string | null;
  category_icon: string | null;
  account_name: string | null;
  account_icon: string | null;
  account_color: string | null;
  account_type: string | null;
  notes: string | null;
  is_excluded: number; // SQLite stores boolean as 0/1
  destinatario_id: string | null;
  destinatario_name: string | null;
  location_place_name: string | null;
  location_place_locality: string | null;
  location_place_country: string | null;
};

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <View className="flex-row items-start justify-between gap-4 px-4 py-3 border-b border-white-6">
      <Text className="text-muted-foreground font-inter text-sm mt-0.5">{label}</Text>
      <Text className="text-foreground font-inter-medium text-sm text-right flex-1 leading-5">
        {value}
      </Text>
    </View>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-4">
      <Text className="text-foreground font-inter-medium text-sm mb-1.5">
        {label}
        {required && <Text className="text-z-expense"> *</Text>}
      </Text>
      {children}
    </View>
  );
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getHeroAmountColorClass(
  isExcluded: boolean,
  isDebtPayment: boolean,
  isInflow: boolean
): string {
  if (isExcluded) return "text-muted-fg-50";
  if (isDebtPayment) return "text-z-brass";
  if (isInflow) return "text-z-income";
  return "text-foreground";
}

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  // Data state
  const [transaction, setTransaction] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [destinatarios, setDestinatarios] = useState<DestinatarioWithCount[]>([]);

  // UI state
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Picker visibility
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showDestinatarioPicker, setShowDestinatarioPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Edit form state
  const [editMerchantName, setEditMerchantName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState(new Date());
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState<string | null>(null);
  const [editDestinatarioId, setEditDestinatarioId] = useState<string | null>(null);
  const [editDestinatarioName, setEditDestinatarioName] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editIsExcluded, setEditIsExcluded] = useState(false);
  const [editTagIds, setEditTagIds] = useState<string[]>([]);

  // Read-only tag list for detail view (id + name so we can show chips and
  // mirror the webapp pattern where chips link to the etiquetas-filtered view).
  const [transactionTags, setTransactionTags] = useState<
    { id: string; name: string }[]
  >([]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [result, tags] = await Promise.all([
          getTransactionById(id) as Promise<TransactionDetail>,
          getTagsForTransaction(id),
        ]);
        setTransaction(result);
        setTransactionTags(tags.map((t) => ({ id: t.id, name: t.name })));
      } catch (err) {
        console.error("Failed to load transaction:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, []);

  const loadCategories = async () => {
    try {
      const cats = await getAllCategories();
      setCategories(cats as CategoryRow[]);
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  };

  const loadDestinatarios = async () => {
    try {
      const list = await getAllDestinatarios();
      setDestinatarios(list);
    } catch (err) {
      console.error("Failed to load destinatarios:", err);
    }
  };

  const showSuccess = () => {
    setSuccessVisible(true);
    if (successTimer.current) clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setSuccessVisible(false), 3000);
  };

  const enterEditMode = async () => {
    if (!transaction || !id) return;
    const txIsDebtPayment = isDebtInflow({
      direction: transaction.direction,
      accountType: transaction.account_type,
    });
    setEditMerchantName(transaction.merchant_name ?? "");
    setEditDescription(transaction.description ?? "");
    setEditAmount(String(Math.abs(transaction.amount)));
    setEditDate(parseLocalDate(transaction.transaction_date));
    setEditCategoryId(
      txIsDebtPayment
        ? DEBT_PAYMENT_CATEGORY_ID
        : transaction.category_id
    );
    setEditCategoryName(
      txIsDebtPayment
        ? "Abono a deuda"
        : transaction.category_name_es
    );
    setEditDestinatarioId(transaction.destinatario_id);
    setEditDestinatarioName(transaction.destinatario_name);
    setEditNotes(transaction.notes ?? "");
    setEditIsExcluded(!!transaction.is_excluded);

    // Load existing tags for edit form
    try {
      const existingTags = await getTagsForTransaction(id);
      setEditTagIds(existingTags.map((t) => t.id));
    } catch {
      setEditTagIds([]);
    }

    setIsEditing(true);
    if (categories.length === 0) loadCategories();
    if (destinatarios.length === 0) loadDestinatarios();
  };

  const cancelEdit = () => setIsEditing(false);

  const handleSave = async () => {
    if (!id) return;
    const amountNum = parseLocalizedAmount(editAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert("Error", "El monto debe ser un número positivo.");
      return;
    }
    setSaving(true);
    try {
      await updateTransaction(id, {
        merchant_name: editMerchantName.trim() || null,
        description: editDescription.trim() || null,
        amount: amountNum,
        transaction_date: toDateString(editDate),
        category_id: isDebtPayment ? DEBT_PAYMENT_CATEGORY_ID : editCategoryId,
        destinatario_id: editDestinatarioId,
        notes: editNotes.trim() || null,
        is_excluded: editIsExcluded,
      });
      // Persist tag changes — the TagSelector mutates `editTagIds` but the
      // tx-update path doesn't carry tags. `saveTransactionTags` does a
      // REPLACE on `transaction_tags` for this id and enqueues a sync row.
      // Mirrors the webapp transaction-form `saveTags` call.
      await saveTransactionTags(id, editTagIds);
      // Reload from DB to get fresh joined data (category_name_es, etc.)
      const [updated, tags] = await Promise.all([
        getTransactionById(id) as Promise<TransactionDetail>,
        getTagsForTransaction(id),
      ]);
      setTransaction(updated);
      setTransactionTags(tags.map((t) => ({ id: t.id, name: t.name })));
      setIsEditing(false);
      showSuccess();
    } catch (err) {
      console.error("Update transaction error:", err);
      Alert.alert("Error", "No se pudo guardar los cambios.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleExclude = async () => {
    if (!transaction || !id) return;
    const isExcluded = !!transaction.is_excluded;
    try {
      await updateTransaction(id, { is_excluded: !isExcluded });
      setTransaction({ ...transaction, is_excluded: isExcluded ? 0 : 1 });
    } catch (err) {
      console.error("Toggle exclude error:", err);
      Alert.alert("Error", "No se pudo actualizar la transacción.");
    }
  };

  const [promoting, setPromoting] = useState(false);

  // ── Vincular (link existing tx to pending occurrence) ────────────────
  const [linkableAccountIds, setLinkableAccountIds] = useState<string[]>([]);
  const [showVincularPicker, setShowVincularPicker] = useState(false);
  const [vincularCandidates, setVincularCandidates] = useState<
    CandidateOccurrence[]
  >([]);
  const [linking, setLinking] = useState(false);
  const [linkedToRecurring, setLinkedToRecurring] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ids, candidates, alreadyLinked] = await Promise.all([
          getAccountIdsWithPendingOccurrences(),
          id ? getCandidateOccurrencesForTransaction(id) : Promise.resolve([]),
          id ? isTransactionLinkedToOccurrence(id) : Promise.resolve(false),
        ]);
        if (cancelled) return;
        setLinkableAccountIds(ids);
        setVincularCandidates(candidates);
        setLinkedToRecurring(alreadyLinked);
      } catch (err) {
        console.error("Failed to load vincular candidates:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Candidates are already loaded in `vincularCandidates` from the mount
  // effect; nothing on this screen invalidates `recurring_occurrences`
  // between mount and tap, and `linkedToRecurring=true` hides the button
  // after a successful link. So just open the sheet.
  const handleOpenVincular = () => {
    setShowVincularPicker(true);
  };

  const handleConfirmVincular = async (occurrenceId: string) => {
    if (!id) return;
    setLinking(true);
    try {
      await linkExistingTransactionToOccurrence(occurrenceId, id);
      setShowVincularPicker(false);
      setLinkedToRecurring(true);
      Alert.alert("Vinculada", "La transacción se vinculó al recurrente.");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "No se pudo vincular.";
      Alert.alert("Error", msg);
    } finally {
      setLinking(false);
    }
  };

  const handlePromoteToRecurring = () => {
    if (!transaction || !session?.user?.id) return;
    const userId = session.user.id;
    const txDate = parseLocalDate(transaction.transaction_date);
    const dayOfMonth = txDate.getDate();
    const merchant =
      transaction.merchant_name ??
      transaction.description ??
      "Pago recurrente";
    Alert.alert(
      "Hacer recurrente",
      `Se creará un pago mensual de ${formatCurrency(
        Math.abs(transaction.amount),
        (transaction.currency_code as CurrencyCode) || "COP"
      )} el día ${dayOfMonth} de cada mes. Puedes ajustarlo en Recurrentes.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Crear",
          onPress: async () => {
            setPromoting(true);
            try {
              await createRecurringTemplate({
                user_id: userId,
                account_id: transaction.account_id,
                amount: Math.abs(transaction.amount),
                currency_code: transaction.currency_code,
                direction: transaction.direction,
                frequency: "MONTHLY",
                start_date: transaction.transaction_date,
                day_of_month: dayOfMonth,
                merchant_name: merchant,
                description: transaction.description ?? null,
                category_id: transaction.category_id,
                destinatario_id: transaction.destinatario_id,
                account_type: transaction.account_type,
              });
              Alert.alert(
                "Recurrente creada",
                "Se programó el próximo pago. Ajústala en Recurrentes.",
                [
                  { text: "OK", style: "default" },
                  {
                    text: "Ver recurrentes",
                    onPress: () => router.push("/recurrentes" as any),
                  },
                ]
              );
            } catch (err) {
              const msg =
                err instanceof Error
                  ? err.message
                  : "No se pudo crear el recurrente.";
              Alert.alert("Error", msg);
            } finally {
              setPromoting(false);
            }
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    if (!id) return;
    Alert.alert(
      "Eliminar transacción",
      "Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTransaction(id);
              router.back();
            } catch (err) {
              console.error("Delete failed:", err);
              Alert.alert("Error", "No se pudo eliminar la transacción.");
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color={COLORS.income} />
      </View>
    );
  }

  if (!transaction) {
    return (
      <View className="flex-1 bg-background">
        <View
        className="flex-row items-center justify-between px-4 pb-2"
        style={{ paddingTop: insets.top + 8 }}
      >
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Volver"
            accessibilityRole="button"
            className="w-8 h-8 items-center justify-center rounded-full bg-black-10 active:bg-black-20"
          >
            <X size={18} color={COLORS.sageDark} />
          </Pressable>
          <Text className="text-foreground font-inter-bold text-base">
            Detalle
          </Text>
          <View className="w-8" />
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-muted-fg-50 font-inter text-base">
            Transacción no encontrada
          </Text>
        </View>
      </View>
    );
  }

  const isInflow = transaction.direction === "INFLOW";
  const isDebtPayment = isDebtInflow({
    direction: transaction.direction,
    accountType: transaction.account_type,
  });
  const isExcluded = !!transaction.is_excluded;
  const STATUS_LABELS: Record<string, string> = {
    CLEARED: "Confirmada",
    PENDING: "Pendiente",
    POSTED: "Registrada",
  };
  const statusLabel = STATUS_LABELS[transaction.status ?? ""] ?? (transaction.status ?? "Desconocido");

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View
        className="flex-row items-center justify-between px-4 pb-2"
        style={{ paddingTop: insets.top + 8 }}
      >
        {isEditing ? (
          <>
            <Pressable
              onPress={cancelEdit}
              className="h-8 px-2 items-center justify-center"
              disabled={saving}
            >
              <Text className="text-muted-foreground font-inter-medium text-sm">
                Cancelar
              </Text>
            </Pressable>
            <Text className="text-foreground font-inter-bold text-base">
              Editar transacción
            </Text>
            <Pressable
              onPress={handleSave}
              className="h-8 px-2 items-center justify-center"
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={COLORS.income} />
              ) : (
                <Text className="text-z-brass font-inter-bold text-sm">
                  Guardar
                </Text>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              onPress={() => router.back()}
              accessibilityLabel="Volver"
              accessibilityRole="button"
              className="w-8 h-8 items-center justify-center rounded-full bg-black-10 active:bg-black-20"
            >
              <X size={18} color={COLORS.sageDark} />
            </Pressable>
            <Text className="text-foreground font-inter-bold text-base">
              Detalle
            </Text>
            <View className="flex-row gap-2">
              <Pressable
                onPress={enterEditMode}
                accessibilityLabel="Editar transacción"
                accessibilityRole="button"
                className="w-8 h-8 items-center justify-center rounded-full bg-black-10 active:bg-black-20"
              >
                <Pencil size={16} color={COLORS.sageDark} />
              </Pressable>
              <Pressable
                onPress={handleDelete}
                accessibilityLabel="Eliminar transacción"
                accessibilityRole="button"
                className="w-8 h-8 items-center justify-center rounded-full bg-z-debt-12 active:bg-z-debt-20"
              >
                <Trash2 size={16} color={COLORS.debt} />
              </Pressable>
            </View>
          </>
        )}
      </View>

      {/* Success banner */}
      {successVisible && (
        <View className="mx-4 mb-2 bg-z-income-10 rounded-xl px-4 py-2.5">
          <Text className="text-z-income font-inter-medium text-sm">
            Cambios guardados correctamente
          </Text>
        </View>
      )}

      {isEditing ? (
        /* ── Edit form ── */
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          >
            {/* Merchant */}
            <FormField label="Comercio">
              <TextInput
                className="bg-black-10 border border-white-6 rounded-xl px-4 py-3 text-foreground font-inter text-sm"
                value={editMerchantName}
                onChangeText={setEditMerchantName}
                placeholder="Nombre del comercio"
                placeholderTextColor={COLORS.sageDark}
                autoCapitalize="words"
              />
            </FormField>

            {/* Description */}
            <FormField label="Descripción">
              <TextInput
                className="bg-black-10 border border-white-6 rounded-xl px-4 py-3 text-foreground font-inter text-sm"
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="Descripción de la transacción"
                placeholderTextColor={COLORS.sageDark}
              />
            </FormField>

            {/* Amount */}
            <FormField label="Monto" required>
              <TextInput
                className="bg-black-10 border border-white-6 rounded-xl px-4 py-3 text-foreground font-inter text-sm"
                value={editAmount}
                onChangeText={setEditAmount}
                placeholder="0"
                placeholderTextColor={COLORS.sageDark}
                keyboardType="decimal-pad"
              />
            </FormField>

            {/* Date */}
            <FormField label="Fecha" required>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                className="bg-black-10 border border-white-6 rounded-xl px-4 py-3 flex-row items-center justify-between active:bg-black-20"
              >
                <Text className="text-foreground font-inter text-sm">
                  {editDate.toLocaleDateString("es-CO", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </Text>
                <Calendar size={16} color={COLORS.sageDark} />
              </Pressable>
            </FormField>

            {/* Category */}
            <FormField label="Categoría">
              {isDebtPayment ? (
                <View className="bg-z-brass-8 border border-z-brass-20 rounded-xl px-4 py-3 flex-row items-center justify-between">
                  <Text className="font-inter-medium text-sm text-z-brass">
                    Abono a deuda
                  </Text>
                  <Text className="font-inter text-xs text-z-brass">
                    Categoría fija
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => setShowCategoryPicker(true)}
                  className="bg-black-10 border border-white-6 rounded-xl px-4 py-3 flex-row items-center justify-between active:bg-black-20"
                >
                  <Text
                    className={`font-inter text-sm ${
                      editCategoryName ? "text-foreground" : "text-muted-fg-50"
                    }`}
                  >
                    {editCategoryName ?? "Sin categoría"}
                  </Text>
                  <Tag size={16} color={COLORS.sageDark} />
                </Pressable>
              )}
            </FormField>

            {/* Destinatario */}
            <FormField label="Destinatario">
              <Pressable
                onPress={() => setShowDestinatarioPicker(true)}
                accessibilityLabel="Cambiar destinatario"
                accessibilityRole="button"
                className="bg-black-10 border border-white-6 rounded-xl px-4 py-3 flex-row items-center justify-between active:bg-black-20"
              >
                <Text
                  className={`font-inter text-sm ${
                    editDestinatarioName ? "text-foreground" : "text-muted-fg-50"
                  }`}
                >
                  {editDestinatarioName ?? "Sin destinatario"}
                </Text>
                <UserRound size={16} color={COLORS.sageDark} />
              </Pressable>
            </FormField>

            {/* Notes */}
            <FormField label="Notas">
              <TextInput
                className="bg-black-10 border border-white-6 rounded-xl px-4 py-3 text-foreground font-inter text-sm"
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="Agregar nota..."
                placeholderTextColor={COLORS.sageDark}
                multiline
                style={{ minHeight: 72, textAlignVertical: "top" }}
              />
            </FormField>

            {/* Etiquetas */}
            <FormField label="Etiquetas">
              <TagSelector selectedTagIds={editTagIds} onChange={setEditTagIds} />
            </FormField>

            {/* Exclude from totals */}
            <View className="flex-row items-center justify-between bg-black-10 border border-white-6 rounded-xl px-4 py-3 mb-4">
              <View className="flex-1 mr-4">
                <Text className="text-foreground font-inter-medium text-sm">
                  Excluir de métricas
                </Text>
                <Text className="text-muted-foreground font-inter text-xs mt-0.5">
                  No contabilizar en estadísticas
                </Text>
              </View>
              <Switch
                value={editIsExcluded}
                onValueChange={setEditIsExcluded}
                trackColor={{ false: COLORS.switchTrack, true: COLORS.income }}
                thumbColor={COLORS.foreground}
                ios_backgroundColor={COLORS.switchTrack}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        /* ── Read-only view ── */
        <ScrollView className="flex-1">
          {/* Amount hero */}
          <View className="items-center pt-6 pb-5 border-b border-white-6 mx-4">
            {transaction.category_icon && (
              <View
                className="h-14 w-14 items-center justify-center rounded-full mb-3"
                style={{
                  backgroundColor:
                    (transaction.category_color ?? COLORS.brass) + "20",
                }}
              >
                <CategoryIcon
                  icon={transaction.category_icon}
                  size={26}
                  color={transaction.category_color ?? COLORS.brass}
                />
              </View>
            )}
            <Text className="text-muted-foreground font-inter text-sm mb-1">
              {getTransactionTypeLabel({
                direction: transaction.direction,
                accountType: transaction.account_type,
              })}
            </Text>
            {isExcluded && (
              <View className="flex-row items-center bg-z-alert-12 px-3 py-1 rounded-full mb-2">
                <Text className="text-z-alert font-inter-medium text-xs">
                  Excluido de totales
                </Text>
              </View>
            )}
            <Text
              className={`font-inter-bold text-4xl ${getHeroAmountColorClass(isExcluded, isDebtPayment, isInflow)}`}
              style={isExcluded ? { textDecorationLine: "line-through" } : undefined}
            >
              {isInflow ? "+" : "-"}
              {formatCurrency(
                Math.abs(transaction.amount),
                (transaction.currency_code as CurrencyCode) || "COP"
              )}
            </Text>
            {transaction.merchant_name && (
              <Text
                className={`font-inter-medium text-base mt-2 ${
                  isExcluded ? "text-muted-fg-50" : "text-foreground"
                }`}
              >
                {transaction.merchant_name}
              </Text>
            )}
          </View>

          {/* Details */}
          <View className="px-4 pt-4 pb-8 gap-5">
            <View>
              <Text className={`${SECTION_EYEBROW_CLASS} mb-2`}>Clasificación</Text>
              <View className="overflow-hidden rounded-2xl border border-white-6 bg-z-surface-2-55">
            <DetailRow
              label="Fecha"
              value={
                transaction.transaction_date
                  ? parseLocalDate(transaction.transaction_date).toLocaleDateString(
                      "es-CO",
                      { year: "numeric", month: "short", day: "numeric" }
                    )
                  : null
              }
            />
            <DetailRow label="Cuenta" value={transaction.account_name} />
            <DetailRow
              label="Ubicacion"
              value={
                [transaction.location_place_name, transaction.location_place_locality]
                  .filter(Boolean)
                  .join(", ") || null
              }
            />
            <DetailRow
              label="Categoría"
              value={isDebtPayment ? "Abono a deuda" : transaction.category_name_es}
            />
            <DetailRow
              label="Destinatario"
              value={transaction.destinatario_name ?? "Sin destinatario"}
            />
            <DetailRow label="Estado" value={statusLabel} />
              </View>
            </View>

            {(transaction.description ||
              transaction.raw_description ||
              transaction.notes) && (
              <View>
                <Text className={`${SECTION_EYEBROW_CLASS} mb-2`}>Detalles</Text>
                <View className="overflow-hidden rounded-2xl border border-white-6 bg-z-surface-2-55">
                  <DetailRow label="Descripción" value={transaction.description} />
                  <DetailRow
                    label="Descripción original"
                    value={transaction.raw_description}
                  />
                  <DetailRow label="Notas" value={transaction.notes} />
                </View>
              </View>
            )}

            {/* Etiquetas — chips, mirrors webapp pattern */}
            {transactionTags.length > 0 && (
              <View className="flex-row items-start rounded-2xl border border-white-6 bg-z-surface-2-55 px-4 py-3">
                <Text className="text-muted-foreground font-inter text-sm w-20 mt-0.5">
                  Etiquetas
                </Text>
                <View className="flex-1 ml-4 flex-row flex-wrap justify-end gap-1.5">
                  {transactionTags.map((t) => (
                    <View
                      key={t.id}
                      className="rounded-full border border-z-brass-20 bg-z-brass-10 px-2.5 py-0.5"
                    >
                      <Text className="text-z-brass font-inter-medium text-xs">
                        {t.name}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Exclude toggle */}
            <View className="flex-row items-center justify-between rounded-2xl border border-white-6 bg-z-surface-2-55 px-4 py-3">
              <View>
                <Text className="text-muted-foreground font-inter text-sm">
                  Excluir de métricas
                </Text>
                <Text className="text-muted-fg-50 font-inter text-xs mt-0.5">
                  No afecta estadísticas ni presupuestos
                </Text>
              </View>
              <Switch
                value={isExcluded}
                onValueChange={handleToggleExclude}
                trackColor={{ false: COLORS.switchTrack, true: COLORS.income }}
                thumbColor={COLORS.foreground}
                ios_backgroundColor={COLORS.switchTrack}
              />
            </View>

            {/* Acciones */}
            <View className="gap-2">
              <Text className={`${SECTION_EYEBROW_CLASS} mb-1`}>Acciones</Text>
              {!isDebtPayment && !linkedToRecurring && (
                <Pressable
                  onPress={handlePromoteToRecurring}
                  disabled={promoting}
                  accessibilityLabel="Hacer recurrente"
                  accessibilityRole="button"
                  className="flex-row items-center justify-center gap-2 rounded-xl border border-z-brass-30 bg-z-brass-10 px-4 py-3 active:bg-z-brass-20"
                  style={promoting ? { opacity: 0.6 } : undefined}
                >
                  <CalendarClock size={14} color={COLORS.brass} />
                  <Text className="text-z-brass font-inter-semibold text-sm">
                    {promoting ? "Creando..." : "Hacer recurrente"}
                  </Text>
                </Pressable>
              )}
              {!linkedToRecurring &&
                linkableAccountIds.includes(transaction.account_id) &&
                vincularCandidates.length > 0 && (
                  <Pressable
                    onPress={handleOpenVincular}
                    disabled={linking}
                    accessibilityLabel="Vincular a recurrente"
                    accessibilityRole="button"
                    className="flex-row items-center justify-center gap-2 rounded-xl border border-white-6 bg-black-10 px-4 py-3 active:bg-black-20"
                    style={linking ? { opacity: 0.6 } : undefined}
                  >
                    <Link2 size={14} color={COLORS.foreground} />
                    <Text className="text-foreground font-inter-semibold text-sm">
                      Vincular a recurrente
                    </Text>
                  </Pressable>
                )}
              {linkedToRecurring && (
                <View className="flex-row items-center justify-center gap-2 rounded-xl border border-z-brass-20 bg-z-brass-8 px-4 py-3">
                  <CalendarClock size={14} color={COLORS.brass} />
                  <Text className="text-z-brass font-inter-medium text-sm">
                    Vinculada a recurrente
                  </Text>
                </View>
              )}
              <Pressable
                onPress={handleDelete}
                accessibilityLabel="Eliminar transacción"
                accessibilityRole="button"
                className="flex-row items-center justify-center gap-2 rounded-xl border border-z-debt-20 bg-z-debt-6 px-4 py-3 active:bg-z-debt-12"
              >
                <Trash2 size={14} color={COLORS.debt} />
                <Text className="text-z-debt font-inter-semibold text-sm">
                  Eliminar transacción
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Category picker — deferred mount until first open */}
      {showCategoryPicker && (
        <CategoryPicker
          visible={showCategoryPicker}
          onClose={() => setShowCategoryPicker(false)}
          onSelect={(catId, catName) => {
            setEditCategoryId(catId);
            setEditCategoryName(catName);
          }}
          selectedId={editCategoryId}
          categories={categories}
        />
      )}

      {/* Destinatario picker — deferred mount until first open */}
      {showDestinatarioPicker && (
        <DestinatarioPicker
          visible={showDestinatarioPicker}
          onClose={() => setShowDestinatarioPicker(false)}
          onSelect={(destId, destName) => {
            setEditDestinatarioId(destId);
            setEditDestinatarioName(destName);
          }}
          selectedId={editDestinatarioId}
          destinatarios={destinatarios}
        />
      )}

      {/* Vincular picker — deferred mount until first open */}
      {showVincularPicker && (
        <VincularPicker
          visible={showVincularPicker}
          onClose={() => setShowVincularPicker(false)}
          candidates={vincularCandidates}
          onSelect={handleConfirmVincular}
          submitting={linking}
          txSubtitle={
            transaction
              ? `${transaction.merchant_name ?? transaction.description ?? ""} · ${formatCurrency(
                  Math.abs(transaction.amount),
                  (transaction.currency_code as CurrencyCode) || "COP"
                )}`
              : undefined
          }
        />
      )}

      {/* Date picker — iOS: spinner in bottom sheet; Android: native dialog */}
      {showDatePicker && Platform.OS === "ios" ? (
        <Modal transparent animationType="slide">
          <View
            className="flex-1 justify-end"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <View className="border border-white-6 bg-background rounded-t-2xl pt-2 pb-6">
              <View className="flex-row justify-end px-4 pb-2">
                <Pressable
                  onPress={() => setShowDatePicker(false)}
                  className="h-8 px-3 items-center justify-center"
                >
                  <Text className="text-z-brass font-inter-bold text-sm">
                    Listo
                  </Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={editDate}
                mode="date"
                display="spinner"
                locale="es-CO"
                onChange={(_, date) => {
                  if (date) setEditDate(date);
                }}
              />
            </View>
          </View>
        </Modal>
      ) : showDatePicker ? (
        <DateTimePicker
          value={editDate}
          mode="date"
          display="default"
          onChange={(_, date) => {
            setShowDatePicker(false);
            if (date) setEditDate(date);
          }}
        />
      ) : null}
    </View>
  );
}
