import { useCallback, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { getForwardingAddress, type ForwardingAddress } from "../../lib/v2/email";
import { Button, IconButton } from "../../v2/components/Button";
import { useV2Theme } from "../../v2/theme/ThemeProvider";

const BANK_SENDER = "alertasynotificaciones@an.notificacionesbancolombia.com";

/**
 * Ajustes › Correos del banco (S9-3, forwarding at launch): your address,
 * how to forward Bancolombia's alerts from Gmail, and Gmail's confirmation
 * link once it arrives. Each alert lands on the account with its last 4.
 */
export default function CorreosScreen() {
  const t = useV2Theme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [state, setState] = useState<{ data?: ForwardingAddress | null; error?: boolean }>({});

  useFocusEffect(useCallback(() => {
    getForwardingAddress().then((data) => setState({ data }), () => setState({ error: true }));
  }, []));

  const text = (s: string, muted = false) => (
    <Text style={{ fontSize: 15, lineHeight: 22, color: muted ? t.colors.muted : t.colors.ink, fontFamily: t.fonts.uiMedium }}>{s}</Text>
  );
  const step = (n: number, s: string) => (
    <View style={styles.step}>
      <Text style={{ width: 20, fontSize: 15, color: t.colors.muted, fontFamily: t.fonts.mono }}>{n}</Text>
      <View style={{ flex: 1 }}>{text(s)}</View>
    </View>
  );
  const d = state.data;
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + 8 }]}>
        <View style={styles.titleRow}>
          <IconButton label="Volver" onPress={() => router.back()} icon={<ChevronLeft size={18} color={t.colors.ink} strokeWidth={2.2} />} />
          <Text accessibilityRole="header" style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>Correos del banco</Text>
        </View>
        {text("Reenvía a Zeta las alertas de Bancolombia y tus movimientos se anotan solos, en la cuenta con esos últimos 4 dígitos.", true)}

        {state.error ? (
          text("No pudimos traer tu dirección. Revisa tu conexión e intenta de nuevo.", true)
        ) : d === undefined ? (
          <ActivityIndicator color={t.colors.muted} style={{ marginTop: 24 }} />
        ) : d === null ? (
          text("Inicia sesión para recibir tus correos del banco.", true)
        ) : (
          <>
            <View style={[styles.card, { backgroundColor: t.colors.card }, t.shadow]}>
              <Text style={{ fontSize: 12, color: t.colors.muted, fontFamily: t.fonts.mono }}>TU DIRECCIÓN</Text>
              <Text selectable accessibilityLabel={`Tu dirección: ${d.address}`} style={{ fontSize: 17, color: t.colors.ink, fontFamily: t.fonts.mono }}>{d.address}</Text>
              <Button label="Compartir o copiar" variant="secondary" onPress={() => void Share.share({ message: d.address })} />
            </View>
            {d.gmailVerificationUrl && (
              <View style={[styles.card, { backgroundColor: t.colors.card }, t.shadow]}>
                {text("Gmail te pide confirmar el reenvío. Ábrelo y confirma.")}
                <Button label="Confirmar en Gmail" onPress={() => void Linking.openURL(d.gmailVerificationUrl!)} />
              </View>
            )}
            <View style={[styles.card, { backgroundColor: t.colors.card }, t.shadow]}>
              <Text style={{ fontSize: 12, color: t.colors.muted, fontFamily: t.fonts.mono }}>EN GMAIL (DESDE UN COMPUTADOR)</Text>
              {step(1, "Configuración › Reenvío y POP/IMAP › Agregar una dirección de reenvío: pega tu dirección.")}
              {step(2, "Gmail manda un correo de confirmación a Zeta; el botón para confirmarlo aparece aquí.")}
              {step(3, `Crea un filtro: De ${BANK_SENDER} › Reenviarlo a tu dirección.`)}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4, paddingTop: 4 },
  title: { flex: 1, fontSize: 26, letterSpacing: -0.5 },
  card: { borderRadius: 18, padding: 14, gap: 10 },
  step: { flexDirection: "row", gap: 6 },
});
