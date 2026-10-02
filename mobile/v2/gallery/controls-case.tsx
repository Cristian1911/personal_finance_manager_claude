import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MoreHorizontal, Search, Trash2 } from "lucide-react-native";
import { Avatar } from "../components/Avatar";
import { Button, IconButton } from "../components/Button";
import { Chip, Segmented } from "../components/Chip";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { TabBar } from "../components/TabBar";
import { useV2Theme } from "../theme/ThemeProvider";

/** The shared controls (S8-8, botones.html) in every state: "/v2-gallery?section=controles". */
export function ControlsCase() {
  const t = useV2Theme();
  const insets = useSafeAreaInsets();
  const [chip, setChip] = useState("todos");
  const [kind, setKind] = useState<"gasto" | "ingreso" | "entre">("gasto");
  const [confirm, setConfirm] = useState<null | "switch" | "logout">(null);
  const [tab, setTab] = useState(0);
  const label = (s: string) => <Text style={[styles.label, { color: t.colors.muted, fontFamily: t.fonts.mono }]}>{s}</Text>;
  const noop = () => undefined;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + 12 }]}>
        <View style={[styles.card, { backgroundColor: t.colors.card }, t.shadow]}>
          {label("Botones L")}
          <Button label="Guardar" onPress={noop} />
          <Button label="Ver movimientos" variant="secondary" onPress={noop} />
          <Button label="Cerrar sesión" variant="destructive" onPress={() => setConfirm("logout")} />
          <Button label="No es un movimiento" variant="text" onPress={noop} style={{ alignSelf: "center" }} />
          {label("Estados")}
          <Button label="Guardar" disabled onPress={noop} />
          <Button label="Guardar" loading onPress={noop} />
          {label("M y S")}
          <View style={styles.line}>
            <Button label="Guardar cambios" variant="secondary" size="M" onPress={noop} />
            <Button label="Sí" size="S" onPress={noop} />
            <Button label="Borrar" size="S" variant="destructive" icon={<Trash2 size={14} color={t.colors.bad.text} />} onPress={noop} />
          </View>
          {label("Iconos")}
          <View style={styles.line}>
            <IconButton label="Buscar" icon={<Search size={17} color={t.colors.ink} />} onPress={noop} />
            <IconButton label="Más" round size={32} icon={<MoreHorizontal size={16} color={t.colors.ink} />} onPress={noop} />
            <IconButton label="Más" disabled icon={<MoreHorizontal size={16} color={t.colors.ink} />} onPress={noop} />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: t.colors.card }, t.shadow]}>
          {label("Chips")}
          <View style={styles.line}>
            {["todos", "gastos", "entradas", "tarjetas"].map((k) => (
              <Chip key={k} label={k[0].toUpperCase() + k.slice(1)} on={chip === k} onPress={() => setChip(k)} />
            ))}
          </View>
          {label("Segmented")}
          <Segmented
            options={[{ key: "gasto", label: "Gasto" }, { key: "ingreso", label: "Ingreso" }, { key: "entre", label: "Entre cuentas" }] as const}
            value={kind}
            onChange={setKind}
          />
          {label("Avatares")}
          <View style={styles.line}>
            <Avatar name="Rappi" kind="comercio" />
            <Avatar name="Laura Gómez" kind="persona" />
            <Avatar name="COMPRA EN TIENDA D1" kind="none" />
            <Avatar name="Google Play" kind="comercio" size={64} />
            <Avatar name="Laura Gómez" kind="persona" size={64} />
          </View>
          {label("Confirmar")}
          <Button label="Dejar de contar esta cuenta" variant="secondary" size="M" onPress={() => setConfirm("switch")} />
        </View>
      </ScrollView>

      <TabBar
        state={{ routes: ["inicio", "movimientos", "pagos", "revisar"].map((name) => ({ name })), index: tab }}
        navigation={{ navigate: (name) => setTab(["inicio", "movimientos", "pagos", "revisar"].indexOf(name)) }}
        onAdd={noop}
      />

      <ConfirmSheet
        open={confirm === "switch"}
        title="¿Dejar de contar Ahorros?"
        consequence="Su saldo de $1.200.000 sale de tu Disponible. Sus movimientos siguen en Movimientos."
        confirmLabel="Dejar de contarla"
        onConfirm={() => setConfirm(null)}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmSheet
        open={confirm === "logout"}
        title="¿Cerrar sesión?"
        consequence="Lo que anotaste sin conexión y aún no se ha enviado se pierde en este teléfono."
        confirmLabel="Cerrar sesión"
        destructive
        onConfirm={() => setConfirm(null)}
        onCancel={() => setConfirm(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 16, paddingBottom: 40 },
  card: { borderRadius: 18, padding: 16, gap: 12 },
  label: { fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" },
  line: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
});
