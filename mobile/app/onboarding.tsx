import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, ArrowRight } from "lucide-react-native";
import { AppKeyboardAwareScrollView } from "../components/common/AppKeyboardAwareScrollView";
import { WizardProgress } from "../components/ui/WizardProgress";
import { StepWelcome } from "../components/onboarding/StepWelcome";
import { StepProfile } from "../components/onboarding/StepProfile";
import { StepPulse } from "../components/onboarding/StepPulse";
import { StepAccount } from "../components/onboarding/StepAccount";
import { StepComplete } from "../components/onboarding/StepComplete";
import {
  DEFAULT_ONBOARDING,
  type OnboardingData,
} from "../components/onboarding/types";
import { COLORS } from "../lib/constants/colors";
import {
  BRASS_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  MOBILE_TAB_BAR_CLEARANCE,
} from "../lib/constants/styles";
import { useTheme, themeSurfaceClasses } from "../lib/theme";
import { parseMoney } from "../lib/utils/money";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

const TOTAL_STEPS = 5;
type StepIndex = 1 | 2 | 3 | 4 | 5;

type StepMeta = {
  eyebrow: string;
  title: string;
  description: string;
};

const STEP_META: Record<StepIndex, StepMeta> = {
  1: {
    eyebrow: "Paso 1 de 5",
    title: "Bienvenido a Zeta",
    description: "Antes de arrancar, cuéntanos qué quieres lograr.",
  },
  2: {
    eyebrow: "Paso 2 de 5",
    title: "Tu perfil",
    description: "Personaliza cómo quieres ver tu dinero.",
  },
  3: {
    eyebrow: "Paso 3 de 5",
    title: "Pulso mensual",
    description:
      "Arranquemos con una estimación rápida. No te preocupes por ser exacto — es una referencia.",
  },
  4: {
    eyebrow: "Paso 4 de 5",
    title: "Primera cuenta",
    description: "Agrega tu cuenta principal para empezar con datos reales.",
  },
  5: {
    eyebrow: "",
    title: "",
    description: "",
  },
};

export default function MobileOnboardingScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, 12);
  const bottomInset = Math.max(insets.bottom + 8, 20);
  const { mode } = useTheme();
  const neutral = mode === "neutral";
  const inkCls = themeSurfaceClasses(mode).ink;
  const actionBarCls = themeSurfaceClasses(mode).actionBar;

  const [step, setStep] = useState<StepIndex>(1);
  const [data, setData] = useState<OnboardingData>(DEFAULT_ONBOARDING);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const canAdvance = useMemo(() => {
    switch (step) {
      case 1:
        return data.purpose !== null;
      case 2:
        return data.firstName.trim().length > 0;
      case 3:
        return (
          parseMoney(data.incomeMonthly) > 0 &&
          parseMoney(data.expensesMonthly) > 0
        );
      case 4:
        return (
          data.accountName.trim().length > 0 &&
          data.balance.trim().length > 0 &&
          Number.isFinite(Number(data.balance))
        );
      case 5:
        return true;
    }
  }, [step, data]);

  const meta = STEP_META[step];

  async function persistOnboarding(): Promise<boolean> {
    if (!session?.user?.id) {
      setError("Sesión expirada. Vuelve a iniciar sesión.");
      return false;
    }
    if (!data.purpose) {
      setError("Elige tu objetivo principal antes de continuar.");
      return false;
    }

    setLoading(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const balanceN = Number(data.balance) || 0;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: data.firstName.trim(),
          app_purpose: data.purpose,
          estimated_monthly_income: parseMoney(data.incomeMonthly),
          estimated_monthly_expenses: parseMoney(data.expensesMonthly),
          preferred_currency: data.currency,
          timezone:
            Intl.DateTimeFormat().resolvedOptions().timeZone ||
            "America/Bogota",
          locale: "es-CO",
          onboarding_completed: true,
          updated_at: now,
        })
        .eq("id", session.user.id);

      if (profileError) throw profileError;

      const { error: accountError } = await supabase.from("accounts").insert({
        user_id: session.user.id,
        name: data.accountName.trim(),
        account_type: data.accountType,
        current_balance: balanceN,
        currency_code: data.currency,
        is_active: true,
        display_order: 0,
        provider: "MANUAL",
        connection_status: "CONNECTED",
        created_at: now,
        updated_at: now,
      });

      if (accountError) throw accountError;
      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo completar el onboarding.",
      );
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleNext() {
    if (loading) return;
    if (!canAdvance) return;
    if (step === 4) {
      const ok = await persistOnboarding();
      if (ok) setStep(5);
      return;
    }
    if (step < TOTAL_STEPS) setStep((step + 1) as StepIndex);
  }

  function handleBack() {
    if (loading) return;
    if (step > 1 && step < 5) setStep((step - 1) as StepIndex);
  }

  function handleFinishPrimary() {
    switch (data.purpose) {
      case "manage_debt":
      case "track_spending":
        router.replace("/(tabs)/import");
        return;
      case "save_money":
        router.replace("/(tabs)/plan");
        return;
      case "improve_habits":
      default:
        router.replace("/(tabs)");
    }
  }

  function handleExplore() {
    router.replace("/(tabs)");
  }

  return (
    <View className={`flex-1 ${inkCls}`} style={{ paddingTop: topInset }}>
      {step < 5 && (
        <View className="px-5 pt-3 pb-4">
          <Text className="text-[11px] font-inter-semibold uppercase tracking-[0.18em] text-z-sage-dark">
            {meta.eyebrow}
          </Text>
          <Text className="mt-1 font-inter-bold text-[22px] text-z-white">
            {meta.title}
          </Text>
          {meta.description ? (
            <Text className="mt-1 font-inter text-sm text-z-sage-light">
              {meta.description}
            </Text>
          ) : null}
          <View className="mt-4">
            <WizardProgress step={step} total={TOTAL_STEPS} />
          </View>
        </View>
      )}

      <AppKeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: step === 5 ? 48 : 0,
          paddingBottom: step < 5 ? MOBILE_TAB_BAR_CLEARANCE : 24,
        }}
        bottomOffset={20}
      >
        {step === 1 && (
          <StepWelcome
            value={data.purpose}
            onChange={(next) => set("purpose", next)}
            neutral={neutral}
          />
        )}

        {step === 2 && (
          <StepProfile
            firstName={data.firstName}
            onFirstNameChange={(next) => set("firstName", next)}
            currency={data.currency}
            onCurrencyChange={(next) => set("currency", next)}
            neutral={neutral}
          />
        )}

        {step === 3 && data.purpose && (
          <StepPulse
            purpose={data.purpose}
            currency={data.currency}
            income={data.incomeMonthly}
            onIncomeChange={(next) => set("incomeMonthly", next)}
            expenses={data.expensesMonthly}
            onExpensesChange={(next) => set("expensesMonthly", next)}
            debtCount={data.debtCount}
            onDebtCountChange={(next) => set("debtCount", next)}
            neutral={neutral}
          />
        )}

        {step === 4 && (
          <StepAccount
            accountName={data.accountName}
            onAccountNameChange={(next) => set("accountName", next)}
            accountType={data.accountType}
            onAccountTypeChange={(next) => set("accountType", next)}
            balance={data.balance}
            onBalanceChange={(next) => set("balance", next)}
            neutral={neutral}
          />
        )}

        {step === 5 && data.purpose && (
          <StepComplete
            firstName={data.firstName}
            purpose={data.purpose}
            onPrimary={handleFinishPrimary}
            onExplore={handleExplore}
            loading={loading}
          />
        )}

        {error ? (
          <View className="mt-5 rounded-xl border border-z-debt-20 bg-z-debt-5 px-4 py-3">
            <Text className="font-inter-semibold text-sm text-z-debt">
              {error}
            </Text>
          </View>
        ) : null}
      </AppKeyboardAwareScrollView>

      {step < 5 && (
        <View
          className={`absolute bottom-0 left-0 right-0 flex-row items-center gap-3 border-t border-white-6 ${actionBarCls} px-4 pt-3`}
          style={{ paddingBottom: bottomInset }}
        >
          {step > 1 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Volver al paso anterior"
              accessibilityState={{ disabled: loading }}
              className={`flex-row items-center gap-2 rounded-xl border ${GHOST_BUTTON_CLASS} px-4 py-3`}
              onPress={handleBack}
              disabled={loading}
            >
              <ArrowLeft size={16} color={COLORS.sageLight} strokeWidth={2} />
              <Text className="font-inter-medium text-sm text-z-sage-light">
                Atrás
              </Text>
            </Pressable>
          ) : (
            <View className="w-[1px]" />
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              step === 4 ? "Finalizar onboarding" : "Siguiente paso"
            }
            accessibilityState={{ disabled: !canAdvance || loading }}
            onPress={handleNext}
            disabled={!canAdvance || loading}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl px-5 py-3.5 ${
              canAdvance && !loading
                ? `${BRASS_BUTTON_CLASS} active:opacity-90`
                : "bg-z-surface-2"
            }`}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.ink} />
            ) : (
              <>
                <Text
                  className={`font-inter-bold text-base ${
                    canAdvance ? "text-z-ink" : "text-z-sage-dark"
                  }`}
                >
                  {step === 4 ? "Finalizar" : "Siguiente"}
                </Text>
                <ArrowRight
                  size={16}
                  color={canAdvance ? COLORS.ink : COLORS.sageDark}
                  strokeWidth={2.2}
                />
              </>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}
