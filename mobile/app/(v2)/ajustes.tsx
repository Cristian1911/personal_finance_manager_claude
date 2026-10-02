import { useCallback, useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { amountTyping, createSqlStorage, formatPesos, parseAmount, type CycleSettings } from "@zeta/shared";
import { useAuth } from "../../lib/auth";
import { LEGAL_URLS, SUPPORT_EMAIL } from "../../lib/constants/urls";
import { deleteAccountV2, signOutV2 } from "../../lib/v2/account";
import { notifyV2Change } from "../../lib/v2/changes";
import { getV2Database } from "../../lib/v2/engine/database";
import { runLocalCommand } from "../../lib/v2/engine/run-local";
import { useV2UserId } from "../../lib/v2/user";
import { Avatar } from "../../v2/components/Avatar";
import { Button, IconButton } from "../../v2/components/Button";
import { Chip, Segmented } from "../../v2/components/Chip";
import { ConfirmSheet } from "../../v2/components/ConfirmSheet";
import { PAY_CHOICES, type PayChoice } from "../../v2/components/FirstRunQuestions";
import { Sheet } from "../../v2/components/Sheet";
import { Tap } from "../../v2/components/Tap";
import { useThemePrefs } from "../../v2/theme/prefs";
import { useV2Theme } from "../../v2/theme/ThemeProvider";

const choiceOf = (s: CycleSettings | null): PayChoice | null => {
  const k = s?.schedule;
  if (!k) return null;
  if (k.kind === "irregular") return "varia";
  if (k.kind === "semimonthly") return "15y30";
  if (k.kind === "monthly") return k.paydays[0] === 15 ? "15" : "30";
  return null;
};

/**
 * Ajustes (S8-7, launch-trimmed): your number (when you get paid, how
 * much, Ahorro, Mis cuentas), how the app looks, help and legal, then
 * Cerrar sesión and Borrar mi cuenta — both ask first.
 */
export default function AjustesScreen() {
  const t = useV2Theme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useV2UserId();
  const { session } = useAuth();
  const { prefs, setPrefs } = useThemePrefs();
  const [settings, setSettings] = useState<CycleSettings | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<"logout" | "delete" | null>(null);
  const [deleting, setDeleting] = useState(false);

  const reload = useCallback(async () => {
    const { driver } = await getV2Database();
    setSettings(await createSqlStorage(driver).getCycleSettings(userId));
  }, [userId]);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  const meta = session?.user.user_metadata as { full_name?: string; name?: string } | undefined;
  const name = meta?.full_name ?? meta?.name ?? null;
  const email = session?.user.email ?? null;
  const choice = PAY_CHOICES.find((c) => c.key === choiceOf(settings));
  const back = () => (router.canGoBack() ? router.back() : router.navigate("/inicio" as never));

  const row = (label: string, value: string | null, onPress: () => void, hint?: string) => (
    <Tap
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}: ${value}` : label}
      accessibilityHint={hint}
      style={(pressed) => [styles.row, pressed && { backgroundColor: t.colors.sunk }]}
    >
      <Text style={{ flex: 1, fontSize: 15, color: t.colors.ink, fontFamily: t.fonts.uiMedium }}>{label}</Text>
      {value ? <Text numberOfLines={1} style={{ maxWidth: "55%", fontSize: 14, color: t.colors.muted, fontFamily: t.fonts.ui }}>{value}</Text> : null}
      <ChevronRight size={16} color={t.colors.control} />
    </Tap>
  );
  const section = (title: string) => <Text style={[styles.section, { color: t.colors.muted, fontFamily: t.fonts.mono }]}>{title}</Text>;
  const card = (children: React.ReactNode) => <View style={[styles.card, { backgroundColor: t.colors.card }, t.shadow]}>{children}</View>;
  const divider = <View style={{ height: 1, backgroundColor: t.colors.line }} />;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + 8 }]}>
        <View style={styles.titleRow}>
          <IconButton label="Volver" onPress={back} icon={<ChevronLeft size={18} color={t.colors.ink} strokeWidth={2.2} />} />
          <Text accessibilityRole="header" style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>Ajustes</Text>
        </View>

        <View style={styles.profile}>
          <Avatar name={name ?? email ?? "?"} kind="persona" size={56} />
          <View style={{ flex: 1, gap: 2 }}>
            {name && <Text style={{ fontSize: 17, color: t.colors.ink, fontFamily: t.fonts.uiSemibold }}>{name}</Text>}
            <Text style={{ fontSize: 14, color: t.colors.muted, fontFamily: t.fonts.ui }}>{email ?? "Sin cuenta: tus datos quedan solo en este teléfono"}</Text>
          </View>
        </View>

        {section("TU NÚMERO")}
        {card(<>
          {row("Cuándo me pagan", settings
            ? [choice?.label, settings.incomePerCycle ? formatPesos(settings.incomePerCycle) : null].filter(Boolean).join(" · ")
            : "Sin responder", () => setEditing(true))}
          {divider}
          {row("Ahorro por ciclo", settings?.savingsPerCycle ? formatPesos(settings.savingsPerCycle) : "Nada", () => setEditing(true), "Lo que apartas antes de calcular tu número")}
          {divider}
          {row("Mis cuentas", null, () => router.push("/cuentas" as never))}
          {divider}
          {row("Correos del banco", null, () => router.push("/correos" as never), "Tus movimientos se anotan solos con las alertas de Bancolombia")}
        </>)}

        {section("APARIENCIA")}
        {card(
          <View style={{ gap: 10, paddingVertical: 12 }}>
            <Segmented options={[{ key: "oliva", label: "Oliva" }, { key: "nitido", label: "Nítido" }] as const} value={prefs.name}
              onChange={(name) => setPrefs({ ...prefs, name })} />
            <Segmented options={[{ key: "system", label: "Automático" }, { key: "light", label: "Claro" }, { key: "dark", label: "Oscuro" }] as const}
              value={prefs.mode} onChange={(mode) => setPrefs({ ...prefs, mode })} />
          </View>,
        )}

        {section("AYUDA")}
        {card(<>
          {row("Escríbenos", SUPPORT_EMAIL, () => void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Zeta`))}
          {divider}
          {row("Privacidad", null, () => void Linking.openURL(LEGAL_URLS.privacy))}
          {divider}
          {row("Términos", null, () => void Linking.openURL(LEGAL_URLS.terms))}
        </>)}

        {session && (
          <View style={{ gap: 6, marginTop: 12 }}>
            <Button label="Cerrar sesión" variant="destructive" onPress={() => setConfirm("logout")} />
            <Button label="Borrar mi cuenta" variant="text" onPress={() => setConfirm("delete")} loading={deleting} style={{ alignSelf: "center" }} />
          </View>
        )}
      </ScrollView>

      <CycleSheet open={editing} settings={settings} onClose={() => setEditing(false)}
        onSave={async (payload) => {
          const { result } = await runLocalCommand({ type: "setCycleSettings", userId, payload });
          if (result.status === "rejected") return result.error ?? "No se pudo guardar.";
          notifyV2Change();
          setEditing(false);
          await reload();
          return null;
        }}
      />
      <ConfirmSheet
        open={confirm === "logout"}
        title="¿Cerrar sesión?"
        consequence="Lo que anotaste queda en tu cuenta y se borra de este teléfono. Para volver, entras con el mismo correo."
        confirmLabel="Cerrar sesión"
        destructive
        onConfirm={async () => {
          setConfirm(null);
          await signOutV2(userId).catch(() => Alert.alert("No se pudo cerrar sesión", "Intenta de nuevo."));
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmSheet
        open={confirm === "delete"}
        title="¿Borrar tu cuenta?"
        consequence="Se borran tu cuenta y todos tus datos: movimientos, cuentas, pagos y ajustes. No se puede deshacer."
        confirmLabel="Borrar todo"
        destructive
        onConfirm={async () => {
          setConfirm(null);
          setDeleting(true);
          try {
            await deleteAccountV2(userId);
          } catch (e) {
            Alert.alert("No se pudo borrar", e instanceof Error ? e.message : "Intenta de nuevo.");
          } finally {
            setDeleting(false);
          }
        }}
        onCancel={() => setConfirm(null)}
      />
    </View>
  );
}

/** Cuándo me pagan, cuánto y el Ahorro, with the same choices as the first run. */
function CycleSheet({ open, settings, onClose, onSave }: {
  open: boolean;
  settings: CycleSettings | null;
  onClose: () => void;
  onSave: (payload: { schedule?: (typeof PAY_CHOICES)[number]["schedule"]; incomePerCycle?: number | null; savingsPerCycle?: number }) => Promise<string | null>;
}) {
  const t = useV2Theme();
  const insets = useSafeAreaInsets();
  const [choice, setChoice] = useState<PayChoice | null>(null);
  const [income, setIncome] = useState("");
  const [savings, setSavings] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setChoice(choiceOf(settings));
    setIncome(settings?.incomePerCycle ? amountTyping(String(settings.incomePerCycle)) : "");
    setSavings(settings?.savingsPerCycle ? amountTyping(String(settings.savingsPerCycle)) : "");
    setError(null);
  }
  if (!open && wasOpen) setWasOpen(false);

  const varia = choice === "varia";
  const save = async () => {
    const picked = PAY_CHOICES.find((c) => c.key === choice);
    if (!picked) return setError("Elige cuándo te pagan.");
    const inc = parseAmount(income);
    if (!varia && !inc) return setError("Escribe cuánto te llega cada vez.");
    const sav = savings.trim() && !/^[$\s0.,]*$/.test(savings) ? parseAmount(savings) : 0;
    if (sav == null) return setError("Escribe el ahorro como 200.000.");
    setSaving(true);
    const problem = await onSave({ schedule: picked.schedule, incomePerCycle: varia ? null : inc, savingsPerCycle: sav });
    setSaving(false);
    if (problem) setError(problem);
  };

  const input = (label: string, value: string, set: (v: string) => void, hint: string) => (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, color: t.colors.muted, fontFamily: t.fonts.uiMedium }}>{label}</Text>
      <TextInput value={value} onChangeText={(v) => { set(amountTyping(v)); setError(null); }} placeholder="$0" placeholderTextColor={t.colors.control}
        keyboardType="decimal-pad" accessibilityLabel={label} accessibilityHint={hint}
        style={[styles.input, { color: t.colors.ink, borderColor: t.colors.control, fontFamily: t.fonts.uiSemibold }]} />
    </View>
  );

  return (
    <Sheet open={open} onClose={onClose} style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
      <View style={[styles.handle, { backgroundColor: t.colors.line }]} />
      <Text accessibilityRole="header" style={[styles.sheetTitle, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>Cuándo me pagan</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
        {PAY_CHOICES.map((c) => <Chip key={c.key} label={c.label} on={choice === c.key} onPress={() => setChoice(c.key)} />)}
      </View>
      {!varia && input("Cuánto te llega cada vez", income, setIncome, "Neto, lo que ves en tu cuenta")}
      {input("Ahorro por ciclo", savings, setSavings, "Se aparta antes de calcular tu número")}
      <Text style={{ fontSize: 13, lineHeight: 19, color: t.colors.muted, fontFamily: t.fonts.ui }}>
        Tu Disponible se recalcula con esto desde hoy. Lo que ya anotaste no cambia.
      </Text>
      {error && <Text accessibilityRole="alert" style={{ color: t.colors.bad.text, fontFamily: t.fonts.uiMedium, fontSize: 14 }}>{error}</Text>}
      <Button label="Guardar" onPress={save} loading={saving} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingBottom: 40, gap: 10 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4, paddingTop: 4 },
  title: { flex: 1, fontSize: 26, letterSpacing: -0.5 },
  profile: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 4, paddingVertical: 8 },
  section: { fontSize: 11, letterSpacing: 0.6, paddingHorizontal: 4, marginTop: 8 },
  card: { borderRadius: 18, paddingHorizontal: 14, overflow: "hidden" },
  // Full width inside the card (the card clips the corners): the pressed tint fills the row, not a box inside it.
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, marginHorizontal: -14, paddingHorizontal: 14 },
  sheet: { maxHeight: "90%", paddingTop: 8, paddingHorizontal: 20, gap: 12 },
  handle: { width: 38, height: 5, borderRadius: 3, alignSelf: "center" },
  sheetTitle: { fontSize: 19, textAlign: "center" },
  input: { height: 46, borderWidth: 1.5, borderRadius: 11, paddingHorizontal: 12, fontSize: 16 },
});
