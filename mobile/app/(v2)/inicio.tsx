import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cycleLabel, type InicioState, type SetCycleSettingsPayload } from "@zeta/shared";
import { runLocalCommand } from "../../lib/v2/engine/run-local";
import { loadInicio } from "../../lib/v2/inicio/load";
import { useV2UserId } from "../../lib/v2/user";
import { DisponibleBlock } from "../../v2/components/DisponibleBlock";
import { FirstRunQuestions } from "../../v2/components/FirstRunQuestions";
import { NumberBreakdown } from "../../v2/components/NumberBreakdown";
import { useV2Theme } from "../../v2/theme/ThemeProvider";

/**
 * v2 Inicio (M1): the Disponible block from the phone's own database, or the
 * first-run questions until they're answered. Reloads whenever the screen
 * comes back into focus, so a movement captured elsewhere shows at once.
 * Widgets and alerts come in later M1 PRs.
 */
export default function InicioScreen() {
  const t = useV2Theme();
  const insets = useSafeAreaInsets();
  const userId = useV2UserId();
  const [state, setState] = useState<InicioState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setState(await loadInicio(userId));
      setError(null);
    } catch (e) {
      console.warn("[v2 inicio] load failed", e);
      setError("No pudimos cargar tu número. Intenta de nuevo.");
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const answer = useCallback(
    async (payload: SetCycleSettingsPayload) => {
      const { result } = await runLocalCommand({ type: "setCycleSettings", userId, payload });
      if (result.status === "rejected") return result.error ?? "No se pudo guardar.";
      await reload();
      return null;
    },
    [userId, reload],
  );

  return (
    <ScrollView
      style={{ backgroundColor: t.colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32, paddingHorizontal: 16, gap: 14 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
    >
      <Text style={[styles.hello, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]} accessibilityRole="header">
        Inicio
      </Text>
      {state?.status === "ready" && (
        <Text style={[styles.cycle, { color: t.colors.muted, fontFamily: t.fonts.ui }]}>{cycleLabel(state.cycle)}</Text>
      )}

      {error && (
        <Text
          style={[styles.cycle, { color: t.colors.bad.text, fontFamily: t.fonts.uiMedium }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      )}
      {!state && !error && <ActivityIndicator color={t.colors.ink} accessibilityLabel="Cargando" />}
      {state?.status === "needs_setup" && <FirstRunQuestions onSubmit={answer} />}
      {state?.status === "ready" && (
        <>
          <DisponibleBlock view={state.view} />
          <NumberBreakdown lines={state.view.breakdown} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hello: { fontSize: 22 },
  cycle: { fontSize: 14, marginTop: -8 },
});
