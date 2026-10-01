import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import type { FlowScreenTab } from "@zeta/shared";
import { loadInicio } from "../../lib/v2/inicio/load";
import { useV2UserId } from "../../lib/v2/user";
import { toColombiaDateString } from "../../lib/utils/date";
import { FlowScreen } from "../../v2/components/FlowScreen";
import { useV2Theme } from "../../v2/theme/ThemeProvider";

/**
 * Tu flujo (M1, S5-2), opened from its Inicio widget. Same local read as
 * Inicio, so the chart here and the widget never disagree.
 */
export default function FlujoScreen() {
  const t = useV2Theme();
  const router = useRouter();
  const userId = useV2UserId();
  const [tabs, setTabs] = useState<FlowScreenTab[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  // Coming back (from Movimientos) keeps the same objects when nothing changed, so the chart and day stay put.
  const lastJson = useRef("");

  useFocusEffect(
    useCallback(() => {
      let live = true;
      loadInicio(userId)
        .then(({ state }) => {
          if (!live) return;
          if (state.status !== "ready") return router.back(); // the first-run questions live on Inicio
          const json = JSON.stringify(state.flow);
          if (json !== lastJson.current) {
            lastJson.current = json;
            setTabs(state.flow);
          }
          setError(null);
        })
        .catch((e) => {
          console.warn("[v2 flujo] load failed", e);
          if (live) setError("No pudimos cargar tu flujo. Intenta de nuevo.");
        });
      return () => { live = false; };
    }, [userId, router]),
  );

  // Ver qué ajustar: your spending, until Límites exists (M4).
  const adjust = useCallback(() => router.push("/transactions" as never), [router]);
  // ponytail: Apartar needs the bill's template (bill_reservations), which reaches the phone in M4.
  const setAside = useCallback(() => Alert.alert("Pronto", "Apartar llega con Pagos en una próxima versión."), []);

  if (!tabs) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.bg, alignItems: "center", justifyContent: "center", gap: 16, padding: 24, paddingTop: insets.top + 24 }}>
        {error
          ? <Text style={{ color: t.colors.bad.text, fontFamily: t.fonts.uiMedium, textAlign: "center" }} accessibilityRole="alert">{error}</Text>
          : <ActivityIndicator color={t.colors.ink} accessibilityLabel="Cargando" />}
        {error && (
          <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ height: 42, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1.5, borderColor: t.colors.control, justifyContent: "center" }}>
            <Text style={{ color: t.colors.ink, fontFamily: t.fonts.uiSemibold, fontSize: 14 }}>Volver</Text>
          </Pressable>
        )}
      </View>
    );
  }
  return <FlowScreen tabs={tabs} today={toColombiaDateString()} onBack={() => router.back()} onAdjust={adjust} onSetAside={setAside} />;
}
