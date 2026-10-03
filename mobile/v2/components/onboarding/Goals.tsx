import { Pressable, StyleSheet, Text, View } from "react-native";
import { Check, Plus } from "lucide-react-native";
import { useV2Theme } from "../../theme/ThemeProvider";
import { Button } from "../Button";
import { Card, Hint, StepLabel, Title } from "./parts";

export type GoalId = "gastar" | "gasto" | "deudas" | "presupuesto" | "amigos" | "ahorro";

const GOALS: { id: GoalId; label: string; sell: string }[] = [
  { id: "gastar", label: "Saber cuánto puedo gastar", sell: "Tu Disponible hasta el sueldo, y por día" },
  { id: "gasto", label: "Entender en qué se me va", sell: "Tus hábitos, gastos hormiga, fijo y variable" },
  { id: "deudas", label: "Ordenar mis deudas", sell: "Cuánto debes, en qué moneda y cuánto te cuesta" },
  { id: "presupuesto", label: "Controlar un presupuesto", sell: "Desde 3 límites suaves hasta el mes completo" },
  { id: "amigos", label: "Llevar cuentas con amigos", sell: "Quién te debe y a quién le debes" },
  { id: "ahorro", label: "Ahorrar para algo", sell: "Una meta y cuánto apartar cada quincena" },
];

/** "¿Qué te gustaría resolver?" — optional; Zeta puts that first. */
export function Goals({ value, onChange, onNext }: { value: GoalId[]; onChange: (g: GoalId[]) => void; onNext: () => void }) {
  const t = useV2Theme();
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.top}>
        <StepLabel>1 DE 2</StepLabel>
        <Button label="Saltar" variant="text" size="S" onPress={onNext} />
      </View>
      <Title>¿Qué te gustaría resolver?</Title>
      <Hint>Elige lo que quieras. Zeta pone eso primero.</Hint>
      <View style={{ gap: 8 }}>
        {GOALS.map((g) => {
          const on = value.includes(g.id);
          const Icon = on ? Check : Plus;
          return (
            <Pressable
              key={g.id}
              onPress={() => onChange(on ? value.filter((x) => x !== g.id) : [...value, g.id])}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${g.label}. ${g.sell}`}
              style={[styles.goal, { backgroundColor: t.colors.card, borderColor: on ? t.colors.ink : t.colors.line, borderWidth: on ? 2 : 1.5 }]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 15, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>{g.label}</Text>
                <Text style={{ fontSize: 12, color: t.colors.muted, fontFamily: t.fonts.ui }}>{g.sell}</Text>
              </View>
              <Icon size={18} color={t.colors.ink} strokeWidth={2.4} />
            </Pressable>
          );
        })}
      </View>
      <Button label="Seguir" onPress={onNext} />
    </View>
  );
}

/** "¿Cómo empezamos?": statements (recommended) or tell it yourself. */
export function PathChoice({ onExtracto, onManual, onBack }: { onExtracto: () => void; onManual: () => void; onBack: () => void }) {
  const t = useV2Theme();
  return (
    <View style={{ gap: 12 }}>
      <StepLabel>2 DE 2</StepLabel>
      <Title>¿Cómo empezamos?</Title>
      <Hint>No necesitas saber tus números exactos. Puedes cambiar de camino cuando quieras.</Hint>
      <Pressable onPress={onExtracto} accessibilityRole="button" accessibilityLabel="Tengo mis extractos. Recomendado, gratis.">
        <Card outlined="strong">
          <View style={[styles.badge, { backgroundColor: t.colors.ok.tint }]}>
            <Text style={{ fontSize: 12, color: t.colors.ok.text, fontFamily: t.fonts.uiSemibold }}>Recomendado · gratis</Text>
          </View>
          <Text style={{ fontSize: 17, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>Tengo mis extractos</Text>
          <Hint>Sube los PDF de tus últimos 3 meses. Zeta saca tus cuentas, tus tarjetas y tus pagos fijos. Te guío para descargarlos.</Hint>
        </Card>
      </Pressable>
      <Pressable onPress={onManual} accessibilityRole="button" accessibilityLabel="Lo digo yo">
        <Card outlined="soft">
          <Text style={{ fontSize: 17, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>Lo digo yo</Text>
          <Hint>Lo básico en 30 segundos. Si tienes más a la mano (pagos, tarjetas, créditos), lo agregas ahí mismo.</Hint>
        </Card>
      </Pressable>
      <Button label="Atrás" variant="text" onPress={onBack} style={{ alignSelf: "center" }} />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  goal: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 },
  badge: { alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
});
