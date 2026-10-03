import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Mail } from "lucide-react-native";
import { useV2Theme } from "../theme/ThemeProvider";
import { Button } from "./Button";

/**
 * "Que tus compras entren solas" (owner, 2026-10-03): automatic capture is
 * the app's best feature and the hardest to set up, so it gets its own card
 * on Hoy that sells the benefit and opens the guide, instead of a checklist
 * line. "Ahora no" hides it for a while; it comes back until capture works.
 */
export const CaptureCard = memo(function CaptureCard({ onSetUp, onLater }: { onSetUp: () => void; onLater: () => void }) {
  const t = useV2Theme();
  const c = t.colors;
  return (
    <View style={[styles.card, { backgroundColor: c.card }, t.shadow]}>
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: c.sunk }]}>
          <Mail size={18} color={c.ink} strokeWidth={2.2} />
        </View>
        <Text accessibilityRole="header" style={{ flex: 1, fontSize: 16, color: c.ink, fontFamily: t.fonts.uiSemibold }}>
          Que tus compras entren solas
        </Text>
      </View>
      <Text style={{ fontSize: 14, lineHeight: 20, color: c.muted, fontFamily: t.fonts.ui }}>
        Reenvía a Zeta los correos de tu banco y cada compra aparece aquí sin anotarla. Tu número se mantiene al día solo. Te guiamos en un par de minutos.
      </Text>
      <View style={styles.actions}>
        <Button label="Ahora no" variant="text" size="M" onPress={onLater} />
        <Button label="Configurarlo" size="M" onPress={onSetUp} style={{ flex: 1 }} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 16, gap: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
});
