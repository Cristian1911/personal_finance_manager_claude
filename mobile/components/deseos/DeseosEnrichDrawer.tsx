import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { ChevronRight, X } from "lucide-react-native";
import type { PurchaseFundingType, PurchaseUrgency } from "@zeta/shared";
import {
  enrichWishlistItem,
  type WishlistItemWithCategory,
} from "../../lib/repositories/wishlist";
import { rescoreWishlistItem } from "../../lib/services/wishlist-scoring";
import { getAllCategories, type CategoryRow } from "../../lib/repositories/categories";
import { getAllAccounts, type AccountRow } from "../../lib/repositories/accounts";
import { CategoryPickerSheet } from "../categorizar/CategoryPickerSheet";
import { MobileSheet } from "../ui/MobileSheet";
import { FieldGroup, SegmentedRow } from "../ui/FormField";
import { COLORS } from "../../lib/constants/colors";
import {
  BRASS_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
} from "../../lib/constants/styles";

type DesireType = "long_held" | "recent" | "spontaneous";

const URGENCY_OPTIONS: ReadonlyArray<{ value: PurchaseUrgency; label: string }> = [
  { value: "NECESSARY", label: "Necesario" },
  { value: "USEFUL", label: "Útil" },
  { value: "IMPULSE", label: "Impulso" },
];

const DESIRE_TYPE_OPTIONS: ReadonlyArray<{ value: DesireType; label: string }> = [
  { value: "long_held", label: "Hace rato" },
  { value: "recent", label: "Reciente" },
  { value: "spontaneous", label: "Espontáneo" },
];

const FUNDING_OPTIONS: ReadonlyArray<{ value: PurchaseFundingType; label: string }> = [
  { value: "ONE_TIME", label: "De contado" },
  { value: "INSTALLMENTS", label: "Cuotas" },
];

interface Props {
  visible: boolean;
  item: WishlistItemWithCategory | null;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function DeseosEnrichDrawer({ visible, item, userId, onClose, onSaved }: Props) {
  const [why, setWhy] = useState("");
  const [urgency, setUrgency] = useState<string>("");
  const [desireType, setDesireType] = useState<string>("");
  const [fundingType, setFundingType] = useState<string>("");
  const [installments, setInstallments] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !item) return;
    setWhy(item.why ?? "");
    setUrgency(item.urgency ?? "");
    setDesireType(item.desire_type ?? "");
    setFundingType(item.funding_type ?? "");
    setInstallments(item.installments?.toString() ?? "");
    setAccountId(item.account_id ?? null);
    setCategoryId(item.category_id ?? null);
    setError(null);
  }, [visible, item]);

  useEffect(() => {
    if (!visible) return;
    Promise.all([getAllAccounts(), getAllCategories()]).then(([accs, cats]) => {
      setAccounts(accs.filter((a) => a.is_active === 1 && a.account_type !== "LOAN"));
      setCategories(cats);
    });
  }, [visible]);

  const selectedCategory = categoryId
    ? categories.find((c) => c.id === categoryId) ?? null
    : null;
  const categoryLabel = selectedCategory
    ? selectedCategory.name_es ?? selectedCategory.name
    : "Sin categoría";

  async function handleSubmit() {
    if (!item) return;
    setError(null);

    if (!urgency || !desireType || !fundingType) {
      setError("Completa todos los campos requeridos");
      return;
    }

    const installmentsNum =
      fundingType === "INSTALLMENTS" && installments
        ? Math.max(2, Math.min(36, Math.round(Number(installments))))
        : null;

    setSaving(true);
    try {
      await enrichWishlistItem({
        id: item.id,
        user_id: userId,
        why: why.trim() || null,
        urgency,
        desire_type: desireType,
        funding_type: fundingType,
        installments: installmentsNum,
        account_id: accountId,
        category_id: categoryId,
      });

      // Re-score immediately so the next render shows the verdict.
      await rescoreWishlistItem({ id: item.id, user_id: userId });

      onSaved();
      onClose();
    } catch (err) {
      console.error("[deseos] enrich failed:", err);
      setError("No se pudo guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  if (!item) return null;

  return (
    <>
      <MobileSheet visible={visible} onClose={onClose}>
        <View className="px-4 pb-4">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-1 pr-3">
              <Text className="text-[10px] font-inter-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                Completar
              </Text>
              <Text className="font-inter-bold text-base text-foreground mt-0.5" numberOfLines={1}>
                {item.name}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              className="h-8 w-8 items-center justify-center rounded-full bg-z-surface-2"
            >
              <X size={16} color={COLORS.sageLight} strokeWidth={2} />
            </Pressable>
          </View>

          <View className="gap-5">
            {/* Why */}
            <FieldGroup label="¿Por qué lo quieres? (opcional)">
              <TextInput
                value={why}
                onChangeText={setWhy}
                multiline
                maxLength={500}
                placeholder="Describe tu motivación..."
                placeholderTextColor={COLORS.sageDark}
                className="rounded-xl border border-white-6 bg-z-surface-2 px-3 py-2.5 font-inter text-sm text-foreground min-h-[60px]"
                style={{ textAlignVertical: "top" }}
              />
            </FieldGroup>

            {/* Urgency */}
            <FieldGroup label="Urgencia">
              <SegmentedRow
                value={urgency}
                onChange={setUrgency}
                options={URGENCY_OPTIONS}
              />
            </FieldGroup>

            {/* Desire type */}
            <FieldGroup label="Tipo de deseo">
              <SegmentedRow
                value={desireType}
                onChange={setDesireType}
                options={DESIRE_TYPE_OPTIONS}
              />
            </FieldGroup>

            {/* Funding */}
            <FieldGroup label="Forma de pago">
              <SegmentedRow
                value={fundingType}
                onChange={setFundingType}
                options={FUNDING_OPTIONS}
              />
            </FieldGroup>

            {/* Installments — only when INSTALLMENTS */}
            {fundingType === "INSTALLMENTS" && (
              <FieldGroup label="Número de cuotas">
                <TextInput
                  value={installments}
                  onChangeText={setInstallments}
                  keyboardType="numeric"
                  placeholder="12"
                  placeholderTextColor={COLORS.sageDark}
                  className="rounded-xl border border-white-6 bg-z-surface-2 px-3 py-2.5 font-inter-semibold text-sm text-foreground tabular-nums w-32"
                />
              </FieldGroup>
            )}

            {/* Account */}
            {accounts.length > 0 && (
              <FieldGroup label="Cuenta de pago">
                <View className="flex-row flex-wrap gap-2">
                  {accounts.map((a) => {
                    const isSelected = a.id === accountId;
                    return (
                      <Pressable
                        key={a.id}
                        onPress={() => setAccountId(isSelected ? null : a.id)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isSelected }}
                        className={`rounded-xl border px-3 py-2 ${
                          isSelected
                            ? "border-z-brass bg-z-brass-12"
                            : "border-white-6 bg-z-surface-2"
                        }`}
                      >
                        <Text
                          className={`font-inter-semibold text-xs ${
                            isSelected ? "text-foreground" : "text-z-sage-light"
                          }`}
                        >
                          {a.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </FieldGroup>
            )}

            {/* Category */}
            <FieldGroup label="Categoría">
              <Pressable
                onPress={() => setPickerOpen(true)}
                className="flex-row items-center justify-between rounded-xl border border-white-6 bg-z-surface-2 px-3 py-3"
              >
                <Text className="font-inter-semibold text-sm text-foreground">
                  {categoryLabel}
                </Text>
                <ChevronRight size={16} color={COLORS.sageDark} />
              </Pressable>
            </FieldGroup>

            {error && (
              <Text className="font-inter text-xs text-z-debt">{error}</Text>
            )}

            <View className="flex-row gap-2 mt-2">
              <Pressable
                onPress={onClose}
                disabled={saving}
                className={`${GHOST_BUTTON_CLASS} flex-1 items-center rounded-xl py-3`}
              >
                <Text className="font-inter-semibold text-sm text-z-sage-light">Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                disabled={saving}
                className={`${BRASS_BUTTON_CLASS} flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3`}
              >
                {saving ? (
                  <ActivityIndicator color={COLORS.ink} />
                ) : (
                  <Text className="font-inter-bold text-sm text-z-ink">
                    Guardar y evaluar
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </MobileSheet>

      <CategoryPickerSheet
        categories={categories}
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(id) => setCategoryId(id)}
      />
    </>
  );
}
