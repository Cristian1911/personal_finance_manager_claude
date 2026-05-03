import { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  Ban,
  Check,
  CheckCircle2,
  Clock,
  Heart,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { useSync } from "../../lib/sync/hooks";
import {
  createWishlistItem,
  deleteWishlistItem,
  dismissWishlistNudge,
  getBoughtWishlistItems,
  markWishlistItemBought,
  type WishlistItemWithCategory,
} from "../../lib/repositories/wishlist";
import {
  getWishlistItemsWithFreshScores,
  rescoreWishlistItem,
  type ScoredWishlistItem,
} from "../../lib/services/wishlist-scoring";
import {
  computeActiveNudges,
  type WishlistNudge,
} from "../../lib/services/wishlist-nudges";
import { useAuth } from "../../lib/auth";
import { getPreferredCurrency } from "../../lib/profile";
import { COLORS } from "../../lib/constants/colors";
import { MobileHeader } from "../ui/MobileHeader";
import { MCard, MCardGrid, MCardGridCell } from "../ui/MCard";
import { MobileZone } from "../ui/MobileZone";
import {
  SECTION_EYEBROW_CLASS,
  BRASS_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  MOBILE_TAB_BAR_CLEARANCE,
} from "../../lib/constants/styles";
import { DeseosEnrichDrawer } from "./DeseosEnrichDrawer";

type Verdict = "BUY" | "BUY_WITH_CAUTION" | "WAIT" | "NOT_RECOMMENDED";

const VERDICT_META: Record<
  Verdict,
  { label: string; iconColor: string; chipBg: string; chipText: string }
> = {
  BUY: {
    label: "Adelante",
    iconColor: COLORS.income,
    chipBg: "bg-z-income-12",
    chipText: "text-z-income",
  },
  BUY_WITH_CAUTION: {
    label: "Con cautela",
    iconColor: COLORS.alert,
    chipBg: "bg-z-alert-12",
    chipText: "text-z-alert",
  },
  WAIT: {
    label: "Espera",
    iconColor: COLORS.expense,
    chipBg: "bg-z-expense-12",
    chipText: "text-z-expense",
  },
  NOT_RECOMMENDED: {
    label: "No",
    iconColor: COLORS.debt,
    chipBg: "bg-z-debt-12",
    chipText: "text-z-debt",
  },
};

const URGENCY_LABEL: Record<string, string> = {
  NECESSARY: "Necesario",
  USEFUL: "Útil",
  IMPULSE: "Impulso",
};

const DESIRE_LABEL: Record<string, string> = {
  long_held: "Hace rato",
  recent: "Reciente",
  spontaneous: "Espontáneo",
};

interface DeseosState {
  active: ScoredWishlistItem[];
  bought: WishlistItemWithCategory[];
  totalAmount: number;
  nudges: WishlistNudge[];
}

const INITIAL: DeseosState = {
  active: [],
  bought: [],
  totalAmount: 0,
  nudges: [],
};

export function DeseosRoot() {
  const { sync } = useSync();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [currency, setCurrency] = useState<CurrencyCode>("COP");
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<DeseosState>(INITIAL);
  const [showForm, setShowForm] = useState(false);
  const [showBought, setShowBought] = useState(false);
  const [formName, setFormName] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [enrichTarget, setEnrichTarget] = useState<WishlistItemWithCategory | null>(null);
  const lastLoadRef = useRef<number>(0);

  const loadData = useCallback(async (force = false) => {
    if (!userId) {
      setData(INITIAL);
      return;
    }
    // Skip rescore work on rapid focus events (tab back, drawer close, etc.).
    // Pull-to-refresh + post-mutation reloads pass force=true.
    const now = Date.now();
    if (!force && now - lastLoadRef.current < 30_000) return;
    lastLoadRef.current = now;
    try {
      const [scored, bought, preferredCurrency] = await Promise.all([
        getWishlistItemsWithFreshScores({ user_id: userId }),
        getBoughtWishlistItems(),
        getPreferredCurrency(),
      ]);
      const total = scored.reduce((sum, i) => sum + (i.amount ?? 0), 0);
      setData({
        active: scored,
        bought,
        totalAmount: total,
        nudges: computeActiveNudges(scored),
      });
      setCurrency(preferredCurrency);
    } catch (error) {
      console.error("Failed to load wishlist:", error);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await sync();
      await loadData(true);
    } finally {
      setRefreshing(false);
    }
  }, [sync, loadData]);

  const handleCreate = useCallback(async () => {
    const amount = parseFloat(formAmount);
    if (!formName.trim() || isNaN(amount) || amount <= 0) return;
    if (!userId) return;

    await createWishlistItem({
      user_id: userId,
      name: formName.trim(),
      amount,
    });

    setFormName("");
    setFormAmount("");
    setShowForm(false);
    await loadData(true);
  }, [formName, formAmount, userId, loadData]);

  const handleEnrich = useCallback((item: WishlistItemWithCategory) => {
    setEnrichTarget(item);
  }, []);

  const handleMarkBought = useCallback(
    async (item: WishlistItemWithCategory) => {
      if (!userId) return;
      Alert.alert(
        "Marcar como comprado",
        `¿Confirmar la compra de "${item.name}"?`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Sí, comprado",
            onPress: async () => {
              await markWishlistItemBought({ id: item.id, user_id: userId });
              await loadData(true);
            },
          },
        ]
      );
    },
    [userId, loadData]
  );

  const handleDelete = useCallback(
    async (item: WishlistItemWithCategory) => {
      if (!userId) return;
      Alert.alert(
        "Eliminar deseo",
        `¿Eliminar "${item.name}"?`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: async () => {
              await deleteWishlistItem({ id: item.id, user_id: userId });
              await loadData(true);
            },
          },
        ]
      );
    },
    [userId, loadData]
  );

  const handleRescore = useCallback(
    async (item: ScoredWishlistItem) => {
      if (!userId) return;
      await rescoreWishlistItem({ id: item.id, user_id: userId });
      await loadData(true);
    },
    [userId, loadData]
  );

  const handleDismissNudge = useCallback(
    async (itemId: string) => {
      if (!userId) return;
      await dismissWishlistNudge({ id: itemId, user_id: userId });
      await loadData(true);
    },
    [userId, loadData]
  );

  const totalActive = data.active.length;
  const totalBought = data.bought.length;

  const activeNudge = data.nudges[0] ?? null;

  return (
    <View className="flex-1 bg-background">
      <MobileHeader
        variant="sub"
        title="Deseos"
        action={
          <Pressable
            onPress={() => setShowForm((v) => !v)}
            className="h-7 w-7 items-center justify-center rounded-full bg-z-brass"
            accessibilityRole="button"
            accessibilityLabel="Agregar deseo"
          >
            <Plus size={14} color={COLORS.ink} strokeWidth={2.5} />
          </Pressable>
        }
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: 16,
          gap: 8,
          paddingBottom: MOBILE_TAB_BAR_CLEARANCE,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.brass}
          />
        }
      >
        {activeNudge && (
          <NudgeBanner
            nudge={activeNudge}
            onDismiss={() => handleDismissNudge(activeNudge.itemId)}
          />
        )}

        {totalActive > 0 && (
          <MCardGrid>
            <MCardGridCell borderRight>
              <Text className="text-[18px] font-inter-bold text-foreground">
                {totalActive}
              </Text>
              <Text className="text-[9px] font-inter text-muted-foreground mt-0.5">
                Deseos activos
              </Text>
            </MCardGridCell>
            <MCardGridCell>
              <Text className="text-[18px] font-inter-bold text-z-alert">
                {formatCurrency(data.totalAmount, currency)}
              </Text>
              <Text className="text-[9px] font-inter text-muted-foreground mt-0.5">
                Total deseado
              </Text>
            </MCardGridCell>
          </MCardGrid>
        )}

        {showForm && (
          <MCard>
            <Text className={`mb-2 ${SECTION_EYEBROW_CLASS}`}>NUEVO DESEO</Text>
            <TextInput
              placeholder="¿Qué quieres?"
              placeholderTextColor={COLORS.sageDark}
              value={formName}
              onChangeText={setFormName}
              className="rounded-lg border border-white-6 bg-black-10 px-3 py-2.5 text-[14px] font-inter text-foreground mb-2"
            />
            <TextInput
              placeholder="Precio estimado"
              placeholderTextColor={COLORS.sageDark}
              value={formAmount}
              onChangeText={setFormAmount}
              keyboardType="numeric"
              className="rounded-lg border border-white-6 bg-black-10 px-3 py-2.5 text-[14px] font-inter text-foreground mb-3"
            />
            <View className="flex-row gap-2">
              <Pressable
                onPress={handleCreate}
                className={`${BRASS_BUTTON_CLASS} flex-1 rounded-lg py-2.5 items-center`}
              >
                <Text className="text-[13px] font-inter-semibold text-z-ink">Agregar</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowForm(false)}
                className={`${GHOST_BUTTON_CLASS} rounded-lg py-2.5 px-4 items-center`}
              >
                <Text className="text-[13px] font-inter-semibold text-z-sage-light">Cancelar</Text>
              </Pressable>
            </View>
          </MCard>
        )}

        {totalActive === 0 && !showForm ? (
          <View className="items-center justify-center py-16">
            <Heart size={48} color={COLORS.sageDark} />
            <Text className="text-[15px] font-inter-semibold text-foreground mt-3">
              Sin deseos todavía
            </Text>
            <Text className="text-[12px] font-inter text-muted-foreground text-center mt-1 max-w-[240px]">
              Agrega cosas que quieres y Zeta te ayuda a evaluar si es buen momento para comprarlas
            </Text>
          </View>
        ) : (
          totalActive > 0 && (
            <MobileZone eyebrow="MIS DESEOS">
              <View className="gap-1.5">
                {data.active.map((item) => (
                  <DeseosRow
                    key={item.id}
                    item={item}
                    currency={currency}
                    onEnrich={handleEnrich}
                    onBought={handleMarkBought}
                    onDelete={handleDelete}
                    onRescore={handleRescore}
                  />
                ))}
              </View>
            </MobileZone>
          )
        )}

        {totalBought > 0 && (
          <View className="mt-2">
            <Pressable
              onPress={() => setShowBought((v) => !v)}
              className="flex-row items-center justify-between py-2"
            >
              <Text className={SECTION_EYEBROW_CLASS}>
                COMPRADOS · {totalBought}
              </Text>
              <Text className="text-[11px] font-inter-semibold text-z-brass">
                {showBought ? "Ocultar" : "Ver"}
              </Text>
            </Pressable>
            {showBought && (
              <View className="gap-1.5">
                {data.bought.map((item) => (
                  <BoughtRow key={item.id} item={item} currency={currency} />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <DeseosEnrichDrawer
        visible={enrichTarget !== null}
        item={enrichTarget}
        userId={userId ?? ""}
        onClose={() => setEnrichTarget(null)}
        onSaved={() => loadData(true)}
      />
    </View>
  );
}

function NudgeBanner({
  nudge,
  onDismiss,
}: {
  nudge: WishlistNudge;
  onDismiss: () => void;
}) {
  return (
    <View className="rounded-xl border border-z-brass-30 bg-z-brass-8 px-3.5 py-3 flex-row items-start gap-3">
      <Sparkles size={16} color={COLORS.brass} strokeWidth={2} />
      <View className="flex-1">
        <Text className="text-[10px] font-inter-semibold uppercase tracking-[0.18em] text-z-brass">
          {nudge.type === "score_transition" ? "Pasó a verde" : "Llegó la hora"}
        </Text>
        <Text className="font-inter text-xs text-z-white mt-0.5">
          {nudge.message}
        </Text>
      </View>
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Descartar aviso"
        className="h-6 w-6 items-center justify-center rounded-full"
      >
        <X size={14} color={COLORS.sageDark} />
      </Pressable>
    </View>
  );
}

const DeseosRow = memo(function DeseosRow({
  item,
  currency,
  onEnrich,
  onBought,
  onDelete,
  onRescore,
}: {
  item: ScoredWishlistItem;
  currency: CurrencyCode;
  onEnrich: (item: WishlistItemWithCategory) => void;
  onBought: (item: WishlistItemWithCategory) => void;
  onDelete: (item: WishlistItemWithCategory) => void;
  onRescore: (item: ScoredWishlistItem) => void;
}) {
  const verdict = (item.freshVerdict ?? item.last_verdict) as Verdict | null;
  const verdictMeta = verdict ? VERDICT_META[verdict] : null;
  const score = item.freshScore ?? item.last_score;
  const VerdictIcon = useMemo(() => {
    if (!verdict) return null;
    if (verdict === "BUY") return ShieldCheck;
    if (verdict === "BUY_WITH_CAUTION") return TriangleAlert;
    if (verdict === "WAIT") return Clock;
    return Ban;
  }, [verdict]);

  const needsEnrichment = !item.enriched;

  return (
    <MCard>
      <View className="gap-2.5">
        {/* Top row: name + price + verdict */}
        <View className="flex-row items-start gap-3">
          <View className="flex-1 min-w-0">
            <Text
              className="text-[14px] font-inter-semibold text-foreground"
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <View className="flex-row items-center gap-2 mt-0.5">
              <Text className="text-[12px] font-inter-medium text-foreground">
                {formatCurrency(item.amount, currency)}
              </Text>
              {item.category_name && (
                <Text className="text-[10px] font-inter text-muted-foreground">
                  · {item.category_name}
                </Text>
              )}
            </View>
          </View>

          {verdictMeta && VerdictIcon ? (
            <View className="items-end gap-1">
              <View
                className={`flex-row items-center gap-1 rounded-full ${verdictMeta.chipBg} px-2 py-0.5`}
              >
                <VerdictIcon size={10} color={verdictMeta.iconColor} strokeWidth={2.2} />
                <Text className={`text-[10px] font-inter-bold ${verdictMeta.chipText}`}>
                  {verdictMeta.label}
                </Text>
              </View>
              {score != null && (
                <Text className="text-[14px] font-inter-bold text-z-white tabular-nums">
                  {Math.round(score)}
                  <Text className="text-[10px] text-muted-foreground"> /100</Text>
                </Text>
              )}
            </View>
          ) : needsEnrichment ? (
            <Pressable
              onPress={() => onEnrich(item)}
              className="rounded-full border border-z-brass-30 bg-z-brass-8 px-2.5 py-1"
              accessibilityRole="button"
              accessibilityLabel="Completar para evaluar"
            >
              <Text className="text-[10px] font-inter-bold text-z-brass">
                Completar
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* Chips row: urgency + desire type */}
        {(item.urgency || item.desire_type) && (
          <View className="flex-row flex-wrap gap-1.5">
            {item.urgency && (
              <View className="rounded-full border border-white-6 px-2 py-0.5">
                <Text className="text-[10px] font-inter-semibold text-z-sage-light">
                  {URGENCY_LABEL[item.urgency] ?? item.urgency}
                </Text>
              </View>
            )}
            {item.desire_type && (
              <View className="rounded-full border border-white-6 px-2 py-0.5">
                <Text className="text-[10px] font-inter-semibold text-z-sage-light">
                  {DESIRE_LABEL[item.desire_type] ?? item.desire_type}
                </Text>
              </View>
            )}
            {item.scoreError && (
              <View className="rounded-full border border-z-debt-30 bg-z-debt-5 px-2 py-0.5">
                <Text className="text-[10px] font-inter-semibold text-z-debt">
                  Error al puntuar
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Action row */}
        <View className="flex-row gap-1.5 -mr-1">
          {!needsEnrichment && (
            <ActionPill
              label="Reevaluar"
              icon={Sparkles}
              onPress={() => onRescore(item)}
            />
          )}
          {needsEnrichment && (
            <ActionPill
              label="Completar"
              icon={Pencil}
              onPress={() => onEnrich(item)}
              tone="brass"
            />
          )}
          <ActionPill
            label="Comprado"
            icon={Check}
            onPress={() => onBought(item)}
            tone="income"
          />
          <ActionPill
            label="Eliminar"
            icon={Trash2}
            onPress={() => onDelete(item)}
            tone="danger"
          />
        </View>
      </View>
    </MCard>
  );
});

function ActionPill({
  label,
  icon: Icon,
  onPress,
  tone = "neutral",
}: {
  label: string;
  icon: typeof Check;
  onPress: () => void;
  tone?: "neutral" | "brass" | "income" | "danger";
}) {
  const colorMap: Record<string, { iconColor: string; textClass: string; borderClass: string }> = {
    neutral: {
      iconColor: COLORS.sageLight,
      textClass: "text-z-sage-light",
      borderClass: "border-white-6",
    },
    brass: {
      iconColor: COLORS.brass,
      textClass: "text-z-brass",
      borderClass: "border-z-brass-30",
    },
    income: {
      iconColor: COLORS.income,
      textClass: "text-z-income",
      borderClass: "border-z-income-30",
    },
    danger: {
      iconColor: COLORS.debt,
      textClass: "text-z-debt",
      borderClass: "border-z-debt-30",
    },
  };
  const styles = colorMap[tone];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`flex-row items-center gap-1 rounded-full border ${styles.borderClass} px-2.5 py-1`}
    >
      <Icon size={11} color={styles.iconColor} strokeWidth={2} />
      <Text className={`text-[11px] font-inter-semibold ${styles.textClass}`}>
        {label}
      </Text>
    </Pressable>
  );
}

const BoughtRow = memo(function BoughtRow({
  item,
  currency,
}: {
  item: WishlistItemWithCategory;
  currency: CurrencyCode;
}) {
  return (
    <MCard>
      <View className="flex-row items-center gap-3">
        <View
          className="h-9 w-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${COLORS.income}20` }}
        >
          <CheckCircle2 size={16} color={COLORS.income} />
        </View>
        <View className="flex-1 min-w-0">
          <Text className="text-[13px] font-inter-semibold text-foreground" numberOfLines={1}>
            {item.name}
          </Text>
          <Text className="text-[11px] font-inter text-muted-foreground mt-0.5">
            {formatCurrency(item.amount, currency)}
            {item.bought_at && ` · ${new Date(item.bought_at).toLocaleDateString("es-CO")}`}
          </Text>
        </View>
      </View>
    </MCard>
  );
});
