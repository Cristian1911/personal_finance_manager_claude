import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  formatPesos, inicioSince, planStatements, readInicioData, statementCommands, statementResult, statementReview,
  type StatementAccount, type StatementChoice, type StatementInput, type StatementPlan, type StatementResult,
} from "@zeta/shared";
import { toColombiaDateString } from "../../lib/utils/date";
import { getV2Database } from "../../lib/v2/engine/database";
import { expoSha256, notifyLocalWrite, runLocalCommand } from "../../lib/v2/engine/run-local";
import { parseStatement } from "../../lib/v2/statement";
import { useV2Theme } from "../theme/ThemeProvider";
import { Button } from "./Button";
import { Chip } from "./Chip";
import { Sheet } from "./Sheet";

type Step =
  | { kind: "reading"; importing?: boolean }
  | { kind: "password"; wrong: boolean }
  | { kind: "review"; plans: StatementPlan[] }
  | { kind: "results"; results: StatementResult[] }
  | { kind: "error"; message: string };

const KIND: Record<StatementPlan["kind"], string> = { savings: "Cuenta", credit_card: "Tarjeta", loan: "Préstamo", investment: "Inversión" };
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
const money = (n: number) => formatPesos(Math.round(n));
const short = (iso: string | null) => (iso ? `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}` : "");

async function phoneAccounts(userId: string): Promise<StatementAccount[]> {
  const { driver } = await getV2Database();
  return (await readInicioData(driver, userId, inicioSince(toColombiaDateString()))).accounts
    .map((a) => ({ id: a.id, name: a.name, accountType: a.accountType, mask: a.mask, cutoffDay: a.cutoffDay }));
}

/**
 * Subir un extracto (S9-3, D1). Zeta's server only reads the PDF (one request);
 * the phone matches the statements to its accounts and imports them as its own
 * commands — instant and offline-first, like anotar; sync replays them on the
 * server in the background. An unknown account asks: create it, pick one, or skip.
 */
export function ExtractoSheet({ file, userId, onClose }: {
  file: { uri: string; name: string } | null;
  userId: string;
  onClose: () => void;
}) {
  const t = useV2Theme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>({ kind: "reading" });
  const [password, setPassword] = useState("");
  const [picks, setPicks] = useState<Record<number, string>>({}); // "create" | accountId | "skip"
  const statements = useRef<StatementInput[]>([]);
  const live = useRef(true);

  const run = async (plans: StatementPlan[], choices: StatementChoice[]) => {
    setStep({ kind: "reading", importing: true });
    const accounts = await phoneAccounts(userId);
    const work = await statementCommands(userId, statements.current, plans, choices, accounts, expoSha256);
    const results: StatementResult[] = [];
    for (const w of work) {
      const out = [];
      for (const s of w.steps) out.push((await runLocalCommand({ type: s.type, userId, payload: s.payload, quiet: true })).result);
      results.push(statementResult(w, out));
    }
    notifyLocalWrite();
    if (live.current) setStep({ kind: "results", results });
  };

  const read = async (pw?: string) => {
    if (!file) return;
    setStep({ kind: "reading" });
    const answer = await parseStatement(file, pw ?? (password || undefined));
    if (!live.current) return;
    if (answer.kind === "password") return setStep({ kind: "password", wrong: !!(pw ?? password) });
    if (answer.kind === "error") return setStep({ kind: "error", message: answer.message });
    statements.current = answer.statements;
    const plans = planStatements(answer.statements, await phoneAccounts(userId));
    // Always shown before importing: what the statement says, and where it goes. An account Zeta didn't
    // recognize has no default: you choose (guessing could put a statement on the wrong card).
    setPicks(Object.fromEntries(plans.map((p) => [p.index, p.accountId ?? (p.suggested ? "" : "skip")])));
    setStep({ kind: "review", plans });
  };

  useEffect(() => {
    live.current = true;
    if (file) { setPassword(""); void read(); }
    return () => { live.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const importWith = (plans: StatementPlan[]) => run(plans,
    plans.filter((p) => p.suggested).map((p): StatementChoice => {
      const pick = picks[p.index];
      if (pick === "skip") return { index: p.index, skip: true };
      if (pick === "create") return { index: p.index, create: { name: p.suggested!.name } };
      return { index: p.index, accountId: pick };
    }));

  const text = (s: string, muted = false, center = false) => (
    <Text style={{ fontSize: 15, lineHeight: 22, textAlign: center ? "center" : "left", color: muted ? t.colors.muted : t.colors.ink, fontFamily: t.fonts.uiMedium }}>{s}</Text>
  );
  return (
    <Sheet open={!!file} onClose={onClose} style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
      <View style={[styles.handle, { backgroundColor: t.colors.line }]} />
      <Text accessibilityRole="header" style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>
        {step.kind === "results" ? "Listo" : "Tu extracto"}
      </Text>

      {step.kind === "reading" && (
        <View style={{ alignItems: "center", gap: 12, paddingVertical: 24 }}>
          <ActivityIndicator color={t.colors.muted} accessibilityLabel="Cargando" />
          {text(step.importing ? "Guardando tus movimientos…" : "Leyendo tu extracto…", true, true)}
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
          <Button label="Abrir" disabled={!password} onPress={() => void read(password)} />
        </>
      )}

      {step.kind === "review" && (
        <>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 14 }}>
            {step.plans.map((p) => {
              const st = statements.current[p.index];
              const r = statementReview(st);
              const card = p.kind === "credit_card" || p.kind === "loan";
              const unknown = !!p.suggested && !p.accountId;
              const fact = (label: string, value: string, strong = false) => (
                <View style={styles.fact}>
                  <Text style={{ fontSize: 11, letterSpacing: 0.5, color: t.colors.muted, fontFamily: t.fonts.mono }}>{label}</Text>
                  <Text style={{ fontSize: strong ? 19 : 16, color: t.colors.ink, fontFamily: t.fonts.numberSemibold, fontVariant: ["tabular-nums"] }}>{value}</Text>
                </View>
              );
              return (
                <View key={p.index} style={[styles.card, { borderColor: t.colors.line }]}>
                  <Text style={{ fontSize: 15, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>
                    {KIND[p.kind]} {cap(p.bank)}{p.last4 ? ` ••${p.last4}` : ""}{p.currency !== "COP" ? ` · ${p.currency}` : ""}
                  </Text>
                  <Text style={{ fontSize: 13, color: t.colors.muted, fontFamily: t.fonts.uiMedium }}>
                    {[r.periodo.from && r.periodo.to ? `${short(r.periodo.from)}–${short(r.periodo.to)}` : null, `${r.movimientos} movimientos`].filter(Boolean).join(" · ")}
                  </Text>
                  {p.suggested ? (
                    <View style={styles.facts}>
                      {r.saldo != null && fact(card ? "DEBES" : "SALDO AL CORTE", money(r.saldo), true)}
                      {r.minimo != null && fact("PAGO MÍNIMO", money(r.minimo), true)}
                      {r.vence && fact("VENCE", short(r.vence))}
                      {r.tasa != null && fact("TASA E.A.", `${r.tasa.toFixed(2).replace(".", ",")}%`)}
                    </View>
                  ) : null}
                  {p.suggested && r.crece && text("Con solo el mínimo la deuda crece: no cubre los intereses.", true)}
                  {p.suggested && r.intereses12 != null && text(`Con solo el mínimo: ${money(r.intereses12)} en intereses en 12 meses y quedarías debiendo ${money(r.queda12 ?? 0)}.`, true)}
                  {!p.suggested && text(p.currency !== "COP" ? `En ${p.currency}: Zeta aún no lleva otras monedas, así que no se importa.` : "Zeta aún no lleva este tipo de cuenta.", true)}
                  {p.accountId && text(`Va a ${p.options.find((o) => o.id === p.accountId)?.name ?? "tu cuenta"}: la reconocimos por sus últimos 4.`, true)}
                  {unknown && (
                    <View style={[styles.alert, { backgroundColor: t.colors.warn.tint }]}>
                      <Text style={{ fontSize: 14, color: t.colors.warn.text, fontFamily: t.fonts.uiSemibold }}>
                        No reconocimos esta {p.kind === "credit_card" ? "tarjeta" : "cuenta"}{p.last4 ? ` (••${p.last4})` : ""}. ¿A dónde va?
                      </Text>
                      <View style={styles.chips}>
                        {p.options.map((o) => <Chip key={o.id} label={`Es ${o.name}`} on={picks[p.index] === o.id} onPress={() => setPicks({ ...picks, [p.index]: o.id })} />)}
                        <Chip label={`Crear «${p.suggested!.name}»`} on={picks[p.index] === "create"} onPress={() => setPicks({ ...picks, [p.index]: "create" })} />
                        <Chip label="No importar" on={picks[p.index] === "skip"} onPress={() => setPicks({ ...picks, [p.index]: "skip" })} />
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
          {step.plans.some((p) => p.suggested && !p.accountId && !picks[p.index]) && text("Elige a dónde va cada extracto para importar.", true, true)}
          <Button label="Importar"
            disabled={step.plans.some((p) => p.suggested && !p.accountId && !picks[p.index]) || step.plans.every((p) => !p.suggested || picks[p.index] === "skip")}
            onPress={() => void importWith(step.plans)} />
        </>
      )}

      {step.kind === "results" && (
        <>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 12 }}>
            {step.results.length === 0 && text("No se importó nada.", true, true)}
            {step.results.map((r) => (
              <View key={r.index} style={[styles.card, { borderColor: t.colors.line }]}>
                <Text style={{ fontSize: 15, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>{r.account}{r.created ? " · nueva" : ""}</Text>
                {r.nota ? text(r.nota, true) : (
                  <>
                    {text([
                      `${r.nuevos} ${r.nuevos === 1 ? "movimiento nuevo" : "movimientos nuevos"}`,
                      r.yaEstaban ? `${r.yaEstaban} ya ${r.yaEstaban === 1 ? "estaba" : "estaban"}` : null,
                      r.paraRevisar ? `${r.paraRevisar} para revisar` : null,
                    ].filter(Boolean).join(" · "))}
                    {r.balance != null && text(`Saldo puesto al corte, más lo de después: ${money(r.balance)}`, true)}
                    {r.minimo != null && text(`Pago mínimo ${money(r.minimo)}${r.vence ? ` · vence el ${short(r.vence)}` : ""} · ya cuenta en tu Disponible`, true)}
                    {r.corte != null && text(`Aprendió su corte (el ${r.corte})${r.pago ? ` y su día de pago (el ${r.pago})` : ""}.`, true)}
                    {r.paraRevisar > 0 && text("Los que son para revisar están en Revisar: Zeta no está segura de si ya los tenías.", true)}
                    {r.errores > 0 && text(`${r.errores} no se pudieron guardar.`, true)}
                  </>
                )}
              </View>
            ))}
          </ScrollView>
          <Button label="Listo" onPress={onClose} />
        </>
      )}

      {step.kind === "error" && (
        <>
          {text(step.message, true, true)}
          <Button label="Intentar de nuevo" onPress={() => void read()} />
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
  facts: { flexDirection: "row", flexWrap: "wrap", rowGap: 10, marginTop: 4 },
  fact: { width: "50%", gap: 2 },
  alert: { borderRadius: 12, padding: 10, gap: 8 },
  input: { height: 46, borderWidth: 1.5, borderRadius: 11, paddingHorizontal: 12, fontSize: 16 },
});
