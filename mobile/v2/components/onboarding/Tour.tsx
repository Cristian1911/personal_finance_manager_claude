import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useV2Theme } from "../../theme/ThemeProvider";
import { Button } from "../Button";
import { Hint, StepLabel, Title } from "./parts";

/**
 * "Así se ve con datos" (S10-3): Laura's Zeta in three screens, before asking
 * anything. Sample data, fixed here — it sells what the user gets.
 */
export function Tour({ onDone }: { onDone: () => void }) {
  const t = useV2Theme();
  const [i, setI] = useState(0);
  const c = t.colors;
  const box = [styles.box, { backgroundColor: c.sunk }];
  const small = { fontSize: 12, color: c.muted, fontFamily: t.fonts.uiMedium };
  const value = { fontSize: 15, color: c.ink, fontFamily: t.fonts.numberSemibold };
  const body = { fontSize: 14, lineHeight: 20, color: c.muted, fontFamily: t.fonts.ui };

  const slides = [
    {
      title: "Cuánto puedes gastar, hoy",
      text: "Así se ve el Hoy de Laura: lo que puede gastar hasta su sueldo, ya descontando lo que tiene que pagar.",
      body: (
        <>
          <View style={[styles.hero, { backgroundColor: c.ok.tint }]}>
            <Text style={{ fontSize: 13, color: c.ok.text, fontFamily: t.fonts.uiSemibold }}>Vas bien</Text>
            <Text style={{ fontSize: 36, letterSpacing: -1, color: c.ink, fontFamily: t.fonts.number }}>$421.100</Text>
            <Text style={{ fontSize: 13, color: c.ok.text, fontFamily: t.fonts.uiMedium }}>$35.000 al día · 12 días para el sueldo</Text>
          </View>
          <View style={styles.row}>
            <View style={box}><Text style={small}>Próximo pago</Text><Text style={value}>Claro · mañana</Text></View>
            <View style={box}><Text style={small}>Tarjeta Nu</Text><Text style={value}>≈ $410.000</Text></View>
          </View>
        </>
      ),
    },
    {
      title: "En qué se le va y cuánto debe",
      text: "Con el tiempo Zeta le muestra sus hábitos, sus deudas y dónde puede mejorar.",
      body: (
        <>
          <Text style={small}>Gasto · septiembre</Text>
          <View style={styles.split} accessible accessibilityLabel="Domicilios 22 por ciento, Mercado 18, Transporte 15">
            <View style={{ flex: 22, backgroundColor: c.ink }} />
            <View style={{ flex: 18, backgroundColor: c.control }} />
            <View style={{ flex: 15, backgroundColor: c.est }} />
            <View style={{ flex: 45, backgroundColor: c.line }} />
          </View>
          <Text style={body}>Domicilios 22% · Mercado 18% · Transporte 15%</Text>
          <Text style={[small, { marginTop: 6 }]}>Debe</Text>
          <Text style={value}>$4.200.000 · $142.000 al mes en intereses</Text>
          <Text style={[small, { marginTop: 6 }]}>Puede mejorar</Text>
          <Text style={body}>Domicilios subió 40% frente a su promedio: +$210.000 este mes.</Text>
        </>
      ),
    },
    {
      title: "Sus herramientas de plata",
      text: "Todo lo que hace con su plata, en un solo lugar. Cada herramienta arranca con sus datos.",
      body: (
        <View style={styles.grid}>
          {[["Te deben", "Estefanía $80.000"], ["Pagos", "3 este ciclo"], ["Presupuesto", "Domicilios: le quedan $60.000"], ["Deuda en dólares", "¿Conviene pagar hoy?"]].map(([a, b]) => (
            <View key={a} style={[box, styles.cell]}>
              <Text style={{ fontSize: 14, color: c.ink, fontFamily: t.fonts.uiSemibold }}>{a}</Text>
              <Text style={small}>{b}</Text>
            </View>
          ))}
        </View>
      ),
    },
  ];
  const s = slides[i];
  const last = i === slides.length - 1;

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <StepLabel>ASÍ SE VE CON DATOS · LAURA</StepLabel>
        <Button label="Saltar" variant="text" size="S" onPress={onDone} />
      </View>
      <Title>{s.title}</Title>
      <Hint>{s.text}</Hint>
      <View style={[styles.stage, { backgroundColor: c.card, borderColor: c.line }]}>{s.body}</View>
      <Text style={{ fontSize: 12, textAlign: "center", color: c.muted, fontFamily: t.fonts.ui }}>Datos de ejemplo</Text>
      <View style={styles.dots} accessible accessibilityLabel={`Pantalla ${i + 1} de ${slides.length}`}>
        {slides.map((_, k) => (
          <View key={k} style={[styles.dot, { width: k === i ? 20 : 8, backgroundColor: k === i ? c.ink : c.est }]} />
        ))}
      </View>
      <Button label={last ? "Quiero esto con mis datos" : "Siguiente"} onPress={() => (last ? onDone() : setI(i + 1))} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stage: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 8 },
  hero: { borderRadius: 16, padding: 16, alignItems: "center", gap: 2 },
  row: { flexDirection: "row", gap: 8 },
  box: { flex: 1, borderRadius: 12, padding: 10, gap: 3, alignItems: "center" },
  split: { flexDirection: "row", height: 14, borderRadius: 7, overflow: "hidden" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: { flexBasis: "47%", alignItems: "flex-start" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { height: 8, borderRadius: 4 },
});
