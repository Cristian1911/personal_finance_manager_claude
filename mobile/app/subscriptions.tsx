import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { Repeat } from "lucide-react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { MobileHeader } from "../components/ui/MobileHeader";
import { COLORS } from "../lib/constants/colors";
import {
  MOBILE_TAB_BAR_CLEARANCE,
  PANEL_INSET_CLASS,
  SECTION_EYEBROW_CLASS,
} from "../lib/constants/styles";
import { getPreferredCurrency } from "../lib/profile";
import {
  cancelSubscription,
  confirmSubscription,
  dismissSubscription,
  getActiveSubscriptions,
  getMonthlyOutflowOccurrences,
  markForCancellation,
  type SubscriptionWithDetails,
} from "../lib/repositories/subscriptions";

/** Calendar bounds of the current month in device-local time (YYYY-MM-DD). */
function currentMonthBounds(): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const mm = String(m + 1).padStart(2, "0");
  const lastDay = new Date(y, m + 1, 0).getDate();
  return {
    start: `${y}-${mm}-01`,
    end: `${y}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

function StatusBadge({ label, tone }: { label: string; tone: "alert" | "muted" }) {
  return (
    <View
      className={`rounded-full px-2.5 py-1 ${
        tone === "alert" ? "bg-z-alert-12" : "bg-black-10"
      }`}
    >
      <Text
        className={`font-inter-medium text-xs ${
          tone === "alert" ? "text-z-alert" : "text-muted-foreground"
        }`}
      >
        {label}
      </Text>
    </View>
  );
}

export default function SubscriptionsScreen() {
  const router = useRouter();
  const [subs, setSubs] = useState<SubscriptionWithDetails[]>([]);
  const [occurrences, setOccurrences] = useState<
    { template_id: string; expected_amount: number }[]
  >([]);
  const [currency, setCurrency] = useState<CurrencyCode>("COP");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const { start, end } = currentMonthBounds();
      const [rows, occs, preferred] = await Promise.all([
        getActiveSubscriptions(),
        getMonthlyOutflowOccurrences(start, end),
        getPreferredCurrency(),
      ]);
      setSubs(rows);
      setOccurrences(occs);
      setCurrency(preferred);
    } catch (error) {
      console.error("Load subscriptions error:", error);
      Alert.alert("Error", "No se pudieron cargar las suscripciones.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  // Mirrors the webapp suscripciones hero: occurrence-backed current-month sum
  // for template-linked subs + estimated for unscheduled ones — NOT a smoothed
  // average, so both platforms show the same "Compromiso mensual".
  const { suggested, tracked, monthlyTotal, markedMonthly, estimatedMonthly } =
    useMemo(() => {
      const sug = subs.filter((s) => s.status === "suggested");
      const trk = subs.filter((s) => s.status !== "suggested");

      const subTemplateIds = new Set(
        trk.map((s) => s.recurring_template_id).filter(Boolean) as string[]
      );
      const monthlyByTemplate = new Map<string, number>();
      let authoritative = 0;
      for (const o of occurrences) {
        if (!subTemplateIds.has(o.template_id)) continue;
        authoritative += o.expected_amount;
        monthlyByTemplate.set(
          o.template_id,
          (monthlyByTemplate.get(o.template_id) ?? 0) + o.expected_amount
        );
      }

      let estimated = 0;
      for (const s of trk) {
        if (!s.recurring_template_id && s.estimated_amount) {
          estimated += s.estimated_amount;
        }
      }

      let marked = 0;
      for (const s of trk) {
        if (s.status !== "marked_for_cancellation") continue;
        marked += s.recurring_template_id
          ? (monthlyByTemplate.get(s.recurring_template_id) ?? 0)
          : (s.estimated_amount ?? 0);
      }

      return {
        suggested: sug,
        tracked: trk,
        monthlyTotal: authoritative + estimated,
        markedMonthly: marked,
        estimatedMonthly: estimated,
      };
    }, [subs, occurrences]);

  const run = useCallback(
    async (id: string, fn: (id: string) => Promise<void>) => {
      setBusyId(id);
      try {
        await fn(id);
        await loadData();
      } catch (error) {
        console.error("Subscription action error:", error);
        Alert.alert(
          "Error",
          error instanceof Error && error.message
            ? error.message
            : "No se pudo actualizar la suscripción."
        );
      } finally {
        setBusyId(null);
      }
    },
    [loadData]
  );

  const handleCancel = useCallback(
    (sub: SubscriptionWithDetails) => {
      Alert.alert(
        "Confirmar cancelación",
        `¿Ya cancelaste "${sub.destinatario_name ?? "esta suscripción"}" con el proveedor? Se desactivará su cobro recurrente.`,
        [
          { text: "Volver", style: "cancel" },
          {
            text: "Ya la cancelé",
            style: "destructive",
            onPress: () => void run(sub.id, cancelSubscription),
          },
        ]
      );
    },
    [run]
  );

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <MobileHeader variant="sub" title="Suscripciones" />
      {loading ? (
        <View
          className="flex-1 items-center justify-center"
          accessibilityLabel="Cargando suscripciones"
        >
          <ActivityIndicator size="large" color={COLORS.brass} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 16,
            gap: 16,
            paddingBottom: MOBILE_TAB_BAR_CLEARANCE,
          }}
        >
          {/* Hero */}
          <View className={`${PANEL_INSET_CLASS} p-4 gap-1`}>
            <Text className={SECTION_EYEBROW_CLASS}>Compromiso mensual</Text>
            <Text className="text-2xl font-inter-bold text-foreground tabular-nums">
              {formatCurrency(monthlyTotal, currency)}
            </Text>
            <Text className="text-[12px] font-inter text-muted-foreground">
              {tracked.length}{" "}
              {tracked.length === 1 ? "suscripción activa" : "suscripciones activas"} ·{" "}
              <Text className="tabular-nums">
                {formatCurrency(monthlyTotal * 12, currency)}
              </Text>{" "}
              al año
            </Text>
            {markedMonthly > 0 && (
              <Text className="text-[12px] font-inter text-z-income">
                Cancelar las marcadas ahorra{" "}
                <Text className="tabular-nums">
                  {formatCurrency(markedMonthly, currency)}
                </Text>
                /mes
              </Text>
            )}
            {estimatedMonthly > 0 && (
              <Text className="text-[12px] font-inter text-muted-foreground">
                Incluye{" "}
                <Text className="tabular-nums">
                  {formatCurrency(estimatedMonthly, currency)}
                </Text>
                /mes estimado (sin programar)
              </Text>
            )}
          </View>

          {/* Sugerencias del detector */}
          {suggested.length > 0 && (
            <View className="gap-2">
              <Text className={SECTION_EYEBROW_CLASS}>Detectadas</Text>
              {suggested.map((sub) => {
                const amount = sub.estimated_amount;
                const busy = busyId === sub.id;
                return (
                  <View key={sub.id} className={`${PANEL_INSET_CLASS} p-4 gap-2`}>
                    <View className="flex-row items-center justify-between gap-3">
                      <Text
                        className="flex-1 text-sm font-inter-semibold text-foreground"
                        numberOfLines={1}
                      >
                        {sub.destinatario_name ?? "Suscripción"}
                      </Text>
                      {amount != null && (
                        <Text className="text-sm font-inter-bold text-foreground tabular-nums">
                          {formatCurrency(amount, (sub.currency_code as CurrencyCode) ?? currency)}
                        </Text>
                      )}
                    </View>
                    <Text className="text-[12px] font-inter text-muted-foreground">
                      Detectamos cobros mensuales repetidos de este comercio.
                    </Text>
                    <View className="flex-row gap-2">
                      <Pressable
                        onPress={() => void run(sub.id, confirmSubscription)}
                        disabled={busyId !== null}
                        accessibilityRole="button"
                        accessibilityLabel={`Rastrear ${sub.destinatario_name ?? "suscripción"}`}
                        accessibilityState={{ disabled: busyId !== null }}
                        className="rounded-xl border border-z-brass-30 bg-z-brass-10 px-3.5 py-2 active:opacity-80"
                        style={busy ? { opacity: 0.5 } : undefined}
                      >
                        <Text className="text-xs font-inter-semibold text-z-brass">
                          Rastrear
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => void run(sub.id, dismissSubscription)}
                        disabled={busyId !== null}
                        accessibilityRole="button"
                        accessibilityLabel={`Descartar ${sub.destinatario_name ?? "sugerencia"}`}
                        accessibilityState={{ disabled: busyId !== null }}
                        className="rounded-xl border border-white-6 bg-z-surface-2 px-3.5 py-2 active:opacity-80"
                        style={busy ? { opacity: 0.5 } : undefined}
                      >
                        <Text className="text-xs font-inter-medium text-muted-foreground">
                          Descartar
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Rastreadas */}
          {tracked.length === 0 ? (
            <View className={`${PANEL_INSET_CLASS} items-center gap-2 p-6`}>
              <Repeat size={20} color={COLORS.sageDark} />
              <Text className="text-sm font-inter-semibold text-foreground">
                No tienes suscripciones registradas todavía
              </Text>
              <Text className="text-center text-[12px] font-inter text-muted-foreground leading-5">
                Crea una plantilla recurrente marcada como suscripción, o importa
                movimientos para que el detector las encuentre.
              </Text>
              <Pressable
                onPress={() => router.push("/recurrentes" as never)}
                accessibilityRole="button"
                accessibilityLabel="Ir a recurrentes"
                className="mt-1 rounded-xl border border-z-brass-30 bg-z-brass-10 px-4 py-2 active:opacity-80"
              >
                <Text className="text-xs font-inter-semibold text-z-brass">
                  Ir a Recurrentes
                </Text>
              </Pressable>
            </View>
          ) : (
            <View className="gap-2">
              <Text className={SECTION_EYEBROW_CLASS}>Rastreadas</Text>
              {tracked.map((sub) => {
                const amount = sub.template_amount ?? sub.estimated_amount;
                const isEstimate = sub.template_amount == null;
                const busy = busyId === sub.id;
                const marked = sub.status === "marked_for_cancellation";
                return (
                  <View key={sub.id} className={`${PANEL_INSET_CLASS} p-4 gap-2.5`}>
                    <View className="flex-row items-center justify-between gap-3">
                      <Text
                        className="flex-1 text-sm font-inter-semibold text-foreground"
                        numberOfLines={1}
                      >
                        {sub.destinatario_name ?? "Suscripción"}
                      </Text>
                      {amount != null && (
                        <Text className="text-sm font-inter-bold text-foreground tabular-nums">
                          {formatCurrency(amount, (sub.currency_code as CurrencyCode) ?? currency)}
                        </Text>
                      )}
                    </View>

                    <View className="flex-row flex-wrap items-center gap-1.5">
                      {sub.template_frequency === "ANNUAL" && (
                        <StatusBadge label="anual" tone="muted" />
                      )}
                      {isEstimate && <StatusBadge label="estimado" tone="muted" />}
                      {sub.status === "trial" && (
                        <StatusBadge label="prueba" tone="alert" />
                      )}
                      {marked && <StatusBadge label="por cancelar" tone="alert" />}
                    </View>

                    <View className="flex-row gap-2">
                      {marked ? (
                        <Pressable
                          onPress={() => handleCancel(sub)}
                          disabled={busyId !== null}
                          accessibilityRole="button"
                          accessibilityLabel={`Confirmar cancelación de ${sub.destinatario_name ?? "suscripción"}`}
                          accessibilityState={{ disabled: busyId !== null }}
                          className="rounded-xl border border-z-debt-30 px-3.5 py-2 active:bg-z-debt-12"
                          style={busy ? { opacity: 0.5 } : undefined}
                        >
                          <Text className="text-xs font-inter-semibold text-z-debt">
                            Ya la cancelé
                          </Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          onPress={() => void run(sub.id, markForCancellation)}
                          disabled={busyId !== null}
                          accessibilityRole="button"
                          accessibilityLabel={`Marcar ${sub.destinatario_name ?? "suscripción"} para cancelar`}
                          accessibilityState={{ disabled: busyId !== null }}
                          className="rounded-xl border border-white-6 bg-z-surface-2 px-3.5 py-2 active:opacity-80"
                          style={busy ? { opacity: 0.5 } : undefined}
                        >
                          <Text className="text-xs font-inter-medium text-muted-foreground">
                            Marcar para cancelar
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
