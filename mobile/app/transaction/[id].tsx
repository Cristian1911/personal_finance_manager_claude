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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Calendar, Pencil, Tag, Trash2, X } from "lucide-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  deleteTransaction,
  getTransactionById,
  updateTransaction,
} from "../../lib/repositories/transactions";
import { getAllCategories } from "../../lib/repositories/categories";
import {
  getTagsForTransaction,
  saveTransactionTags,
} from "../../lib/repositories/tags";
import {
  CategoryPicker,
  type CategoryRow,
} from "../../components/transactions/CategoryPicker";
import { TagSelector } from "../../components/transactions/TagSelector";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import {
  DEBT_PAYMENT_CATEGORY_ID,
  getTransactionTypeLabel,
  isDebtInflow,
} from "../../lib/transaction-semantics";
import { parseLocalizedAmount } from "../../lib/amount";
import { COLORS } from "../../lib/constants/colors";

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
  account_name: string | null;
  account_icon: string | null;
  account_color: string | null;
  account_type: string | null;
  notes: string | null;
  is_excluded: number; // SQLite stores boolean as 0/1
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
    <View className="flex-row items-start py-3 border-b border-white-6">
      <Text className="text-muted-foreground font-inter text-sm w-20 mt-0.5">{label}</Text>
      <Text className="text-foreground font-inter-medium text-sm text-right flex-1 ml-4 leading-5">
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

  // Data state
  const [transaction, setTransaction] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryRow[]>([]);

  // UI state
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Picker visibility
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Edit form state
  const [editMerchantName, setEditMerchantName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState(new Date());
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editIsExcluded, setEditIsExcluded] = useState(false);
  const [editTagIds, setEditTagIds] = useState<string[]>([]);

  // Read-only tag names for detail view
  const [transactionTagNames, setTransactionTagNames] = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [result, tags] = await Promise.all([
          getTransactionById(id) as Promise<TransactionDetail>,
          getTagsForTransaction(id),
        ]);
        setTransaction(result);
        setTransactionTagNames(tags.map((t) => t.name));
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
        notes: editNotes.trim() || null,
        is_excluded: editIsExcluded,
      });
      // Reload from DB to get fresh joined data (category_name_es, etc.)
      const updated = (await getTransactionById(id)) as TransactionDetail;
      setTransaction(updated);
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
      Alert.alert("Error", "No se pudo actualizar la transaccion.");
    }
  };

  const handleDelete = () => {
    if (!id) return;
    Alert.alert(
      "Eliminar transaccion",
      "Esta accion no se puede deshacer.",
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
              Alert.alert("Error", "No se pudo eliminar la transaccion.");
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
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <Pressable
            onPress={() => router.back()}
            className="w-8 h-8 items-center justify-center rounded-full bg-black-10 active:bg-z-surface-2/10"
          >
            <X size={18} color="#938C7E" />
          </Pressable>
          <Text className="text-foreground font-inter-bold text-base">
            Detalle
          </Text>
          <View className="w-8" />
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-muted-fg-50 font-inter text-base">
            Transaccion no encontrada
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
      <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
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
                <Text className="text-primary font-inter-bold text-sm">
                  Guardar
                </Text>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              onPress={() => router.back()}
              className="w-8 h-8 items-center justify-center rounded-full bg-black-10 active:bg-z-surface-2/10"
            >
              <X size={18} color="#938C7E" />
            </Pressable>
            <Text className="text-foreground font-inter-bold text-base">
              Detalle
            </Text>
            <View className="flex-row gap-2">
              <Pressable
                onPress={enterEditMode}
                className="w-8 h-8 items-center justify-center rounded-full bg-black-10 active:bg-z-surface-2/10"
              >
                <Pencil size={16} color="#938C7E" />
              </Pressable>
              <Pressable
                onPress={handleDelete}
                className="w-8 h-8 items-center justify-center rounded-full bg-z-debt/10 active:bg-z-debt/20"
              >
                <Trash2 size={16} color={COLORS.debt} />
              </Pressable>
            </View>
          </>
        )}
      </View>

      {/* Success banner */}
      {successVisible && (
        <View className="mx-4 mb-2 bg-z-income/10 rounded-xl px-4 py-2.5">
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
                placeholderTextColor="#938C7E"
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
                placeholderTextColor="#938C7E"
              />
            </FormField>

            {/* Amount */}
            <FormField label="Monto" required>
              <TextInput
                className="bg-black-10 border border-white-6 rounded-xl px-4 py-3 text-foreground font-inter text-sm"
                value={editAmount}
                onChangeText={setEditAmount}
                placeholder="0"
                placeholderTextColor="#938C7E"
                keyboardType="decimal-pad"
              />
            </FormField>

            {/* Date */}
            <FormField label="Fecha" required>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                className="bg-black-10 border border-white-6 rounded-xl px-4 py-3 flex-row items-center justify-between active:bg-z-surface-2/10"
              >
                <Text className="text-foreground font-inter text-sm">
                  {editDate.toLocaleDateString("es-CO", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </Text>
                <Calendar size={16} color="#938C7E" />
              </Pressable>
            </FormField>

            {/* Category */}
            <FormField label="Categoría">
              {isDebtPayment ? (
                <View className="bg-sky-900/20 border border-sky-700/30 rounded-xl px-4 py-3 flex-row items-center justify-between">
                  <Text className="font-inter-medium text-sm text-z-brass">
                    Abono a deuda
                  </Text>
                  <Text className="font-inter text-xs text-z-brass">
                    Categoria fija
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => setShowCategoryPicker(true)}
                  className="bg-black-10 border border-white-6 rounded-xl px-4 py-3 flex-row items-center justify-between active:bg-z-surface-2/10"
                >
                  <Text
                    className={`font-inter text-sm ${
                      editCategoryName ? "text-foreground" : "text-muted-fg-50"
                    }`}
                  >
                    {editCategoryName ?? "Sin categoría"}
                  </Text>
                  <Tag size={16} color="#938C7E" />
                </Pressable>
              )}
            </FormField>

            {/* Notes */}
            <FormField label="Notas">
              <TextInput
                className="bg-black-10 border border-white-6 rounded-xl px-4 py-3 text-foreground font-inter text-sm"
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="Agregar nota..."
                placeholderTextColor="#938C7E"
                multiline
                style={{ minHeight: 72, textAlignVertical: "top" }}
              />
            </FormField>

            {/* Exclude from totals */}
            <View className="flex-row items-center justify-between bg-black-10 border border-white-6 rounded-xl px-4 py-3 mb-4">
              <View className="flex-1 mr-4">
                <Text className="text-foreground font-inter-medium text-sm">
                  Excluir de totales
                </Text>
                <Text className="text-muted-foreground font-inter text-xs mt-0.5">
                  No contabilizar en estadísticas
                </Text>
              </View>
              <Switch
                value={editIsExcluded}
                onValueChange={setEditIsExcluded}
                trackColor={{ false: "#3A3A3A", true: COLORS.income }}
                thumbColor={COLORS.foreground}
                ios_backgroundColor="#3A3A3A"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        /* ── Read-only view ── */
        <ScrollView className="flex-1">
          {/* Amount hero */}
          <View className="items-center pt-6 pb-5 border-b border-white-6 mx-4">
            <Text className="text-muted-foreground font-inter text-sm mb-1">
              {getTransactionTypeLabel({
                direction: transaction.direction,
                accountType: transaction.account_type,
              })}
            </Text>
            {isExcluded && (
              <View className="flex-row items-center bg-amber-900/20 px-3 py-1 rounded-full mb-2">
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
          <View className="px-4 pt-2 pb-8">
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
              label="Categoria"
              value={isDebtPayment ? "Abono a deuda" : transaction.category_name_es}
            />
            <DetailRow label="Estado" value={statusLabel} />
            <DetailRow label="Descripcion" value={transaction.description} />
            <DetailRow
              label="Descripcion original"
              value={transaction.raw_description}
            />
            <DetailRow label="Notas" value={transaction.notes} />

            {/* Exclude toggle */}
            <View className="flex-row items-center justify-between py-3 border-b border-white-6">
              <View>
                <Text className="text-muted-foreground font-inter text-sm">
                  Excluir de totales
                </Text>
                <Text className="text-muted-fg-50 font-inter text-xs mt-0.5">
                  No afecta estadísticas ni presupuestos
                </Text>
              </View>
              <Switch
                value={isExcluded}
                onValueChange={handleToggleExclude}
                trackColor={{ false: "#3A3A3A", true: COLORS.income }}
                thumbColor={COLORS.foreground}
                ios_backgroundColor="#3A3A3A"
              />
            </View>
          </View>
        </ScrollView>
      )}

      {/* Category picker */}
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

      {/* Date picker — iOS: spinner in bottom sheet; Android: native dialog */}
      {showDatePicker && Platform.OS === "ios" ? (
        <Modal transparent animationType="slide">
          <View className="flex-1 justify-end bg-black/40">
            <View className="bg-z-surface-2-55 rounded-t-2xl pt-2 pb-6">
              <View className="flex-row justify-end px-4 pb-2">
                <Pressable
                  onPress={() => setShowDatePicker(false)}
                  className="h-8 px-3 items-center justify-center"
                >
                  <Text className="text-primary font-inter-bold text-sm">
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
