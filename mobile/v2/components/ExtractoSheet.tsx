import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import { formatPesos } from "@zeta/shared";
import { uploadStatement, type StatementChoice, type StatementPlan, type StatementResult } from "../../lib/v2/statement";
import { useV2Theme } from "../theme/ThemeProvider";
import { Button } from "./Button";
import { Chip } from "./Chip";
import { Sheet } from "./Sheet";

type Step =
  | { kind: "reading"; importing?: boolean }
  | { kind: "password"; wrong: boolean }
  | { kind: "needs"; plans: StatementPlan[] }
  | { kind: "results"; results: StatementResult[] }
  | { kind: "error"; message: string };

const KIND: Record<StatementPlan["kind"], string> = { savings: "Cuenta", credit_card: "Tarjeta", loan: "Préstamo", investment: "Inversión" };
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const short = (iso: string | null) => (iso ? `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}` : "");

/**
 * Subir un extracto (S9-3, D1): reads the PDF on Zeta's server. A statement
 * whose account isn't known asks: create it (the default), pick one, or skip.
 * Then a summary per account; the movements arrive with the next sync.
 */
export function ExtractoSheet({ file, onClose, onImported }: {
  file: { uri: string; name: string } | null;
  onClose: () => void;
  onImported: () => void;
}) {
  const t = useV2Theme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>({ kind: "reading" });
  const [password, setPassword] = useState("");
  const [picks, setPicks] = useState<Record<number, string>>({}); // "create" | accountId | "skip"
  const live = useRef(true);

  const send = async (opts: { password?: string; choices?: StatementChoice[] } = {}) => {
    if (!file) return;
    setStep({ kind: "reading", importing: !!opts.choices });
    const answer = await uploadStatement(file, { password: opts.password ?? (password || undefined), choices: opts.choices });
    if (!live.current) return;
    if (answer.kind === "password") setStep({ kind: "password", wrong: !!(opts.password ?? password) });
    else if (answer.kind === "needs") {
      setPicks(Object.fromEntries(answer.plans.map((p) => [p.index, p.accountId ?? (p.suggested ? "create" : "skip")])));
      setStep({ kind: "needs", plans: answer.plans });
    } else if (answer.kind === "results") {
      setStep({ kind: "results", results: answer.results });
      onImported();
    } else setStep({ kind: "error", message: answer.message });
  };

  useEffect(() => {
    live.current = true;
    if (file) { setPassword(""); void send(); }
    return () => { live.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const importWith = (plans: StatementPlan[]) => send({
    choices: plans.map((p): StatementChoice => {
      const pick = picks[p.index];
      if (pick === "skip") return { index: p.index, skip: true };
      if (pick === "create") return { index: p.index, create: { accountId: Crypto.randomUUID().toLowerCase(), name: p.suggested!.name } };
      return { index: p.index, accountId: pick };
    }),
  });

  const text = (s: string, muted = false, center = false) => (
    <Text style={{ fontSize: 15, lineHeight: 22, textAlign: center ? "center" : "left", color: muted ? t.colors.muted : t.colors.ink, fontFamily: t.fonts.uiMedium }}>{s}</Text>
  );
  const busy = step.kind === "reading";
  return (
    <Sheet open={!!file} onClose={busy ? () => {} : onClose} style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
      <View style={[styles.handle, { backgroundColor: t.colors.line }]} />
      <Text accessibilityRole="header" style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>
        {step.kind === "results" ? "Listo" : "Tu extracto"}
      </Text>

      {step.kind === "reading" && (
        <View style={{ alignItems: "center", gap: 12, paddingVertical: 24 }}>
          <ActivityIndicator color={t.colors.muted} />
          {text(step.importing ? "Guardando tus movimientos… puede tardar un minuto." : "Leyendo tu extracto…", true, true)}
        </View>
      )}

      {step.kind === "password" && (
        <>
          {text(step.wrong ? "Esa contraseña no abrió el PDF. Intenta otra." : "Este PDF tiene contraseña. Suele ser tu cédula.", true)}
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoFocus
            placeholder="Contraseña del PDF"
            placeholderTextColor={t.colors.control}
            accessibilityLabel="Contraseña del PDF"
            style={[styles.input, { color: t.colors.ink, borderColor: t.colors.control, fontFamily: t.fonts.uiSemibold }]}
          />
          <Button label="Abrir" disabled={!password} onPress={() => void send({ password })} />
        </>
      )}

      {step.kind === "needs" && (
        <>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 14 }}>
            {step.plans.map((p) => (
              <View key={p.index} style={[styles.card, { borderColor: t.colors.line }]}>
                <Text style={{ fontSize: 15, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>
                  {KIND[p.kind]} {p.bank.charAt(0) + p.bank.slice(1).toLowerCase()}{p.last4 ? ` ••${p.last4}` : ""}
                </Text>
                <Text style={{ fontSize: 13, color: t.colors.muted, fontFamily: t.fonts.uiMedium }}>
                  {[`${p.rows} movimientos`, p.period.from && p.period.to ? `${short(p.period.from)}–${short(p.period.to)}` : null].filter(Boolean).join(" · ")}
                </Text>
                {!p.accountId && (
                  <View style={styles.chips}>
                    {p.suggested && <Chip label={`Crear «${p.suggested.name}»`} on={picks[p.index] === "create"} onPress={() => setPicks({ ...picks, [p.index]: "create" })} />}
                    {p.options.map((o) => <Chip key={o.id} label={`Es ${o.name}`} on={picks[p.index] === o.id} onPress={() => setPicks({ ...picks, [p.index]: o.id })} />)}
                    <Chip label="No importar" on={picks[p.index] === "skip"} onPress={() => setPicks({ ...picks, [p.index]: "skip" })} />
                  </View>
                )}
                {p.accountId && text(`Va a ${p.options.find((o) => o.id === p.accountId)?.name ?? "tu cuenta"}.`, true)}
                {!p.suggested && text("Zeta aún no lleva inversiones.", true)}
              </View>
            ))}
          </ScrollView>
          <Button label="Importar" disabled={step.plans.every((p) => picks[p.index] === "skip")} onPress={() => void importWith(step.plans)} />
        </>
      )}

      {step.kind === "results" && (
        <>
          {step.results.length === 0 && text("No se importó nada.", true, true)}
          {step.results.map((r) => (
            <View key={r.index} style={[styles.card, { borderColor: t.colors.line }]}>
              <Text style={{ fontSize: 15, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>{r.account}{r.created ? " (nueva)" : ""}</Text>
              {text([
                `${r.nuevos} ${r.nuevos === 1 ? "movimiento nuevo" : "movimientos nuevos"}`,
                r.yaEstaban ? `${r.yaEstaban} ya estaban` : null,
                r.paraRevisar ? `${r.paraRevisar} para revisar` : null,
              ].filter(Boolean).join(" · "), true)}
              {r.otraMoneda > 0 && text(`${r.otraMoneda} en otra moneda quedaron fuera por ahora.`, true)}
              {r.errores > 0 && text(`${r.errores} no se pudieron guardar.`, true)}
              {r.balance != null && text(`Saldo al corte, con lo de después: ${formatPesos(r.balance)}`)}
            </View>
          ))}
          <Button label="Listo" onPress={onClose} />
        </>
      )}

      {step.kind === "error" && (
        <>
          {text(step.message, true, true)}
          <Button label="Intentar de nuevo" onPress={() => void send()} />
          <Button label="Cerrar" variant="text" onPress={onClose} style={{ alignSelf: "center" }} />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: "90%", paddingTop: 8, paddingHorizontal: 20, gap: 12 },
  handle: { width: 38, height: 5, borderRadius: 3, alignSelf: "center" },
  title: { fontSize: 19, textAlign: "center" },
  card: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  input: { height: 46, borderWidth: 1.5, borderRadius: 11, paddingHorizontal: 12, fontSize: 16 },
});
