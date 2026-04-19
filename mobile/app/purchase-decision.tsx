import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowLeft,
  ShieldCheck,
  TriangleAlert,
  Clock,
  Ban,
  Heart,
  CheckCircle2,
  CreditCard,
  Landmark,
  PiggyBank,
  Wallet,
} from "lucide-react-native";
import type { LucideProps } from "lucide-react-native";
import type { ComponentType } from "react";
import {
  formatCurrency,
  type CurrencyCode,
  type PurchaseDecisionResult,
  type PurchaseFundingType,
  type PurchaseUrgency,
} from "@zeta/shared";
import { AppKeyboardAwareScrollView } from "../components/common/AppKeyboardAwareScrollView";
import { Narrator } from "../components/common/Narrator";
import { getAllAccounts, type AccountRow } from "../lib/repositories/accounts";
import { createWishlistItem } from "../lib/repositories/wishlist";
import { analyzeLocally } from "../lib/services/purchase-decision";
import { useAuth } from "../lib/auth";
import { COLORS } from "../lib/constants/colors";
import {
  BRASS_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  MOBILE_TAB_BAR_CLEARANCE,
} from "../lib/constants/styles";
import { useTheme, themeSurfaceClasses } from "../lib/theme";
import { parseMoney } from "../lib/utils/money";
import { toLocalMonthString } from "../lib/utils/date";

type Verdict = PurchaseDecisionResult["verdict"];

const URGENCY_OPTIONS: { value: PurchaseUrgency; label: string }[] = [
  { value: "NECESSARY", label: "Necesidad" },
  { value: "USEFUL", label: "Útil" },
  { value: "IMPULSE", label: "Capricho" },
];

const FUNDING_OPTIONS: { value: PurchaseFundingType; label: string }[] = [
  { value: "ONE_TIME", label: "Pago único" },
  { value: "INSTALLMENTS", label: "Cuotas" },
];

type VerdictMeta = {
  label: string;
  icon: ComponentType<LucideProps>;
  badgeBg: string;
  badgeText: string;
  scoreColor: string;
  border: string;
  /** Short, one-line summary narrator can wrap. */
  narratorTone: "brass" | "sage";
};

const VERDICT_META: Record<Verdict, VerdictMeta> = {
  BUY: {
    label: "Sí, adelante",
    icon: ShieldCheck,
    badgeBg: "bg-z-income-12",
    badgeText: "text-z-income",
    scoreColor: "text-z-income",
    border: "border-z-income-30",
    narratorTone: "brass",
  },
  BUY_WITH_CAUTION: {
    label: "Sí, con cautela",
    icon: TriangleAlert,
    badgeBg: "bg-z-alert-12",
    badgeText: "text-z-alert",
    scoreColor: "text-z-alert",
    border: "border-z-alert-25",
    narratorTone: "brass",
  },
  WAIT: {
    label: "Mejor espera",
    icon: Clock,
    badgeBg: "bg-z-expense-12",
    badgeText: "text-z-expense",
    scoreColor: "text-z-expense",
    border: "border-z-expense-30",
    narratorTone: "sage",
  },
  NOT_RECOMMENDED: {
    label: "No recomendado",
    icon: Ban,
    badgeBg: "bg-z-debt-12",
    badgeText: "text-z-debt",
    scoreColor: "text-z-debt",
    border: "border-z-debt-30",
    narratorTone: "sage",
  },
};

const SEVERITY_DOT: Record<string, string> = {
  positive: "bg-z-income",
  warning: "bg-z-alert",
  critical: "bg-z-debt",
};

const ACCOUNT_ICON: Record<string, ComponentType<LucideProps>> = {
  CHECKING: Landmark,
  SAVINGS: PiggyBank,
  CREDIT_CARD: CreditCard,
  CASH: Wallet,
};

export default function PurchaseDecisionScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, 12);
  const { mode } = useTheme();
  const neutral = mode === "neutral";
  const inkCls = themeSurfaceClasses(mode).ink;
  const surface = neutral ? "bg-z-surface-2-neutral" : "bg-z-surface-2";

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [amount, setAmount] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null,
  );
  const [urgency, setUrgency] = useState<PurchaseUrgency>("USEFUL");
  const [fundingType, setFundingType] =
    useState<PurchaseFundingType>("ONE_TIME");
  const [installments, setInstallments] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PurchaseDecisionResult | null>(null);
  const [savedToWishlist, setSavedToWishlist] = useState(false);
  const [savingWishlist, setSavingWishlist] = useState(false);

  useEffect(() => {
    getAllAccounts().then((rows) => {
      const payable = rows.filter(
        (r) => r.is_active === 1 && r.account_type !== "LOAN",
      );
      setAccounts(payable);
      if (payable.length > 0 && !selectedAccountId) {
        setSelectedAccountId(payable[0].id);
      }
    });
    // intentionally empty deps — only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  );
  const currency: CurrencyCode =
    (selectedAccount?.currency_code as CurrencyCode | undefined) ?? "COP";

  const handleAnalyze = useCallback(async () => {
    if (loading) return;
    setError(null);
    setSavedToWishlist(false);
    const numAmount = parseMoney(amount);
    if (!numAmount || numAmount <= 0) {
      setError("Ingresa un monto válido.");
      return;
    }
    if (!selectedAccountId) {
      setError("Selecciona una cuenta.");
      return;
    }

    setLoading(true);
    try {
      const month = toLocalMonthString();
      const res = await analyzeLocally({
        amount: numAmount,
        accountId: selectedAccountId,
        urgency,
        fundingType,
        installments:
          fundingType === "INSTALLMENTS"
            ? Number(installments) || 1
            : null,
        month,
      });
      setResult(res);
    } catch (err) {
      console.error("[afford] analyzeLocally failed:", err);
      setError("No se pudo analizar la compra. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [
    loading,
    amount,
    selectedAccountId,
    urgency,
    fundingType,
    installments,
  ]);

  const handleSaveToWishlist = useCallback(async () => {
    if (savingWishlist || savedToWishlist) return;
    if (!session?.user?.id || !result) return;
    const numAmount = parseMoney(amount);
    if (!numAmount) return;

    const name =
      result.summary.length > 60
        ? result.summary.slice(0, 57).trim() + "…"
        : result.summary || "Compra por decidir";

    setSavingWishlist(true);
    try {
      await createWishlistItem({
        user_id: session.user.id,
        name,
        amount: numAmount,
        currency_code: currency,
        urgency,
        why: result.reasons[0]?.detail ?? null,
      });
      setSavedToWishlist(true);
    } catch (err) {
      console.error("[afford] createWishlistItem failed:", err);
      setError("No se pudo guardar en deseos. Intenta de nuevo.");
    } finally {
      setSavingWishlist(false);
    }
  }, [savingWishlist, savedToWishlist, session, result, amount, currency, urgency]);

  const verdictMeta = result ? VERDICT_META[result.verdict] : null;
  const shouldOfferWishlist =
    result !== null &&
    (result.verdict === "WAIT" || result.verdict === "NOT_RECOMMENDED");

  return (
    <View className={`flex-1 ${inkCls}`} style={{ paddingTop: topInset }}>
      {/* Header */}
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => router.back()}
          className={`h-9 w-9 items-center justify-center rounded-full ${surface}`}
        >
          <ArrowLeft size={18} color={COLORS.sageLight} strokeWidth={2} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-[11px] font-inter-semibold uppercase tracking-[0.18em] text-z-sage-dark">
            Afford
          </Text>
          <Text className="mt-0.5 font-inter-bold text-lg text-z-white">
            ¿Debería comprar esto?
          </Text>
        </View>
      </View>

      <AppKeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: MOBILE_TAB_BAR_CLEARANCE,
        }}
        bottomOffset={24}
      >
        {/* Monto */}
        <View className="gap-1.5">
          <Text className="text-[11px] font-inter-semibold uppercase tracking-[0.18em] text-z-sage-dark">
            Monto
          </Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="250000"
            placeholderTextColor={COLORS.sageDark}
            accessibilityLabel="Monto de la compra"
            className={`rounded-xl border border-z-sage-10 ${surface} px-4 py-3.5 font-inter-semibold text-lg text-z-white tabular-nums`}
          />
        </View>

        {/* Cuenta */}
        <View className="mt-5 gap-1.5">
          <Text className="text-[11px] font-inter-semibold uppercase tracking-[0.18em] text-z-sage-dark">
            Cuenta
          </Text>
          {accounts.length === 0 ? (
            <View
              className={`rounded-xl border border-white-6 ${surface} px-4 py-3`}
            >
              <Text className="font-inter text-sm text-z-sage-light">
                No tienes cuentas activas. Agrega una antes de analizar.
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingRight: 4 }}
            >
              {accounts.map((a) => {
                const isSelected = a.id === selectedAccountId;
                const Icon = ACCOUNT_ICON[a.account_type] ?? Landmark;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => setSelectedAccountId(a.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={a.name}
                    className={`flex-row items-center gap-2 rounded-xl border px-3.5 py-3 ${
                      isSelected
                        ? "border-z-brass bg-z-brass-12"
                        : `border-white-6 ${surface}`
                    }`}
                  >
                    <Icon
                      size={14}
                      color={isSelected ? COLORS.brass : COLORS.sageDark}
                      strokeWidth={2}
                    />
                    <Text
                      className={`font-inter-semibold text-sm ${
                        isSelected ? "text-z-white" : "text-z-sage-light"
                      }`}
                    >
                      {a.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Urgencia */}
        <View className="mt-5 gap-1.5">
          <Text className="text-[11px] font-inter-semibold uppercase tracking-[0.18em] text-z-sage-dark">
            Urgencia
          </Text>
          <View
            accessibilityRole="radiogroup"
            className="flex-row gap-2"
          >
            {URGENCY_OPTIONS.map((opt) => {
              const isSelected = urgency === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setUrgency(opt.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={opt.label}
                  className={`flex-1 items-center rounded-xl border py-3 ${
                    isSelected
                      ? "border-z-brass bg-z-brass-12"
                      : `border-white-6 ${surface}`
                  }`}
                >
                  <Text
                    className={`font-inter-semibold text-sm ${
                      isSelected ? "text-z-white" : "text-z-sage-light"
                    }`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Forma de pago */}
        <View className="mt-5 gap-1.5">
          <Text className="text-[11px] font-inter-semibold uppercase tracking-[0.18em] text-z-sage-dark">
            Forma de pago
          </Text>
          <View
            accessibilityRole="radiogroup"
            className="flex-row gap-2"
          >
            {FUNDING_OPTIONS.map((opt) => {
              const isSelected = fundingType === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setFundingType(opt.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={opt.label}
                  className={`flex-1 items-center rounded-xl border py-3 ${
                    isSelected
                      ? "border-z-brass bg-z-brass-12"
                      : `border-white-6 ${surface}`
                  }`}
                >
                  <Text
                    className={`font-inter-semibold text-sm ${
                      isSelected ? "text-z-white" : "text-z-sage-light"
                    }`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {fundingType === "INSTALLMENTS" && (
          <View className="mt-5 gap-1.5">
            <Text className="text-[11px] font-inter-semibold uppercase tracking-[0.18em] text-z-sage-dark">
              Número de cuotas
            </Text>
            <TextInput
              value={installments}
              onChangeText={setInstallments}
              keyboardType="numeric"
              placeholder="12"
              placeholderTextColor={COLORS.sageDark}
              accessibilityLabel="Número de cuotas"
              className={`rounded-xl border border-z-sage-10 ${surface} px-4 py-3 font-inter-semibold text-base text-z-white tabular-nums`}
            />
          </View>
        )}

        {error ? (
          <View className="mt-5 rounded-xl border border-z-debt-20 bg-z-debt-5 px-4 py-3">
            <Text className="font-inter-semibold text-sm text-z-debt">
              {error}
            </Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Analizar la compra"
          accessibilityState={{ disabled: loading }}
          onPress={handleAnalyze}
          disabled={loading}
          className={`mt-6 flex-row items-center justify-center gap-2 rounded-xl ${BRASS_BUTTON_CLASS} py-3.5 active:opacity-90`}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.ink} />
          ) : (
            <Text className="font-inter-bold text-base text-z-ink">
              Analizar
            </Text>
          )}
        </Pressable>

        {/* Results */}
        {result && verdictMeta && (
          <View className="mt-6 gap-4">
            {/* Verdict hero */}
            <View
              className={`rounded-2xl border ${verdictMeta.border} ${surface} p-4`}
            >
              <View className="flex-row items-center justify-between gap-3">
                <View
                  className={`flex-row items-center gap-2 rounded-full ${verdictMeta.badgeBg} px-3 py-1.5`}
                >
                  <verdictMeta.icon
                    size={14}
                    color={
                      result.verdict === "BUY"
                        ? COLORS.income
                        : result.verdict === "BUY_WITH_CAUTION"
                          ? COLORS.alert
                          : result.verdict === "WAIT"
                            ? COLORS.expense
                            : COLORS.debt
                    }
                    strokeWidth={2.2}
                  />
                  <Text
                    className={`font-inter-bold text-xs ${verdictMeta.badgeText}`}
                  >
                    {verdictMeta.label}
                  </Text>
                </View>
                <View className="flex-row items-baseline gap-1">
                  <Text
                    className={`font-inter-bold text-[32px] tabular-nums ${verdictMeta.scoreColor}`}
                  >
                    {result.score}
                  </Text>
                  <Text className="font-inter text-sm text-z-sage-dark">
                    /100
                  </Text>
                </View>
              </View>
              <Narrator tone={verdictMeta.narratorTone} spacing="tight">
                {result.summary}
              </Narrator>
            </View>

            {/* Save to wishlist CTA */}
            {shouldOfferWishlist && !savedToWishlist && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Guardar esta compra en deseos"
                accessibilityState={{ disabled: savingWishlist }}
                onPress={handleSaveToWishlist}
                disabled={savingWishlist}
                className={`flex-row items-center justify-center gap-2 rounded-xl ${GHOST_BUTTON_CLASS} py-3`}
              >
                {savingWishlist ? (
                  <ActivityIndicator color={COLORS.sageLight} />
                ) : (
                  <>
                    <Heart
                      size={16}
                      color={COLORS.sageLight}
                      strokeWidth={2}
                    />
                    <Text className="font-inter-semibold text-sm text-z-sage-light">
                      Guardar en deseos para después
                    </Text>
                  </>
                )}
              </Pressable>
            )}
            {savedToWishlist && (
              <View className="flex-row items-center justify-center gap-2 rounded-xl border border-z-income-30 bg-z-income-12 py-3">
                <CheckCircle2
                  size={16}
                  color={COLORS.income}
                  strokeWidth={2}
                />
                <Text className="font-inter-semibold text-sm text-z-income">
                  Guardado en deseos
                </Text>
              </View>
            )}

            {/* Metrics grid */}
            <View
              className={`rounded-2xl border border-white-6 ${surface} p-4`}
            >
              <Text className="text-[11px] font-inter-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                Impacto financiero
              </Text>
              <View className="mt-3 flex-row flex-wrap gap-2.5">
                <MetricTile
                  label="Desembolso"
                  value={formatCurrency(
                    result.metrics.effectiveImmediateImpact,
                    currency,
                  )}
                  neutral={neutral}
                />
                <MetricTile
                  label="Colchón proyectado"
                  value={formatCurrency(
                    result.metrics.projectedLiquidBuffer,
                    currency,
                  )}
                  neutral={neutral}
                />
                <MetricTile
                  label="Colchón recomendado"
                  value={formatCurrency(
                    result.metrics.recommendedBuffer,
                    currency,
                  )}
                  neutral={neutral}
                />
                <MetricTile
                  label="Flujo libre mensual"
                  value={formatCurrency(
                    result.metrics.monthlyFreeCashflow,
                    currency,
                  )}
                  neutral={neutral}
                />
                {result.metrics.estimatedMonthlyInstallment > 0 && (
                  <MetricTile
                    label="Cuota estimada"
                    value={formatCurrency(
                      result.metrics.estimatedMonthlyInstallment,
                      currency,
                    )}
                    neutral={neutral}
                  />
                )}
                {result.metrics.selectedAccountUtilizationAfter != null && (
                  <MetricTile
                    label="Uso del cupo después"
                    value={`${result.metrics.selectedAccountUtilizationAfter.toFixed(0)}%`}
                    neutral={neutral}
                  />
                )}
              </View>
            </View>

            {/* Reasons */}
            {result.reasons.length > 0 && (
              <View
                className={`rounded-2xl border border-white-6 ${surface} p-4`}
              >
                <Text className="text-[11px] font-inter-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                  Por qué
                </Text>
                <View className="mt-3 gap-3">
                  {result.reasons.map((r, i) => (
                    <View key={i} className="flex-row gap-2.5">
                      <View
                        className={`mt-1.5 h-2 w-2 rounded-full ${SEVERITY_DOT[r.severity] ?? "bg-z-sage-dark"}`}
                      />
                      <View className="flex-1">
                        <Text className="font-inter-semibold text-sm text-z-white">
                          {r.title}
                        </Text>
                        <Text className="mt-0.5 font-inter text-xs text-z-sage-light">
                          {r.detail}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Alternatives */}
            {result.alternatives.length > 0 && (
              <View
                className={`rounded-2xl border border-white-6 ${surface} p-4`}
              >
                <Text className="text-[11px] font-inter-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                  Qué podrías hacer en vez
                </Text>
                <View className="mt-3 gap-3">
                  {result.alternatives.map((a, i) => (
                    <View key={i}>
                      <Text className="font-inter-semibold text-sm text-z-white">
                        {a.title}
                      </Text>
                      <Text className="mt-0.5 font-inter text-xs text-z-sage-light">
                        {a.detail}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
      </AppKeyboardAwareScrollView>
    </View>
  );
}

function MetricTile({
  label,
  value,
  neutral,
}: {
  label: string;
  value: string;
  neutral: boolean;
}) {
  const bg = neutral ? "bg-z-surface-3-neutral" : "bg-black-20";
  return (
    <View
      className={`w-[47.5%] rounded-xl border border-white-6 ${bg} px-3 py-2.5`}
    >
      <Text className="text-[10px] font-inter-semibold uppercase tracking-[0.14em] text-z-sage-dark">
        {label}
      </Text>
      <Text className="mt-0.5 font-inter-bold text-sm text-z-white tabular-nums">
        {value}
      </Text>
    </View>
  );
}
