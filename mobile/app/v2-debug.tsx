import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Redirect } from "expo-router";
import * as Crypto from "expo-crypto";
import { applyAndEnqueue, createSqlStorage, type CommandEnvelope, type CommandResult } from "@zeta/shared";
import { MobileHeader } from "../components/ui/MobileHeader";
import {
  BRASS_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  MOBILE_TAB_BAR_CLEARANCE,
  PANEL_SURFACE_CLASS,
} from "../lib/constants/styles";
import { COLORS } from "../lib/constants/colors";
import { useAuth } from "../lib/auth";
import { toColombiaDateString } from "../lib/utils/date";
import { V2_DEBUG_ENABLED } from "../lib/v2/flags";
import { getV2Database, resetV2Database } from "../lib/v2/engine/database";
import { expoSha256, replayLocalCommand, runLocalCommand } from "../lib/v2/engine/run-local";
import { runSelfTest, type SelfTestCheck } from "../lib/v2/engine/self-test";

const TEST_ACCOUNT = "0000aaaa-0000-4000-8000-00000000c0de";
const LOCAL_USER = "00000000-0000-4000-8000-000000000001";

type Snapshot = { balance: number | null; note: string | null; pending: number };

function Action({
  label,
  onPress,
  primary,
  disabled,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={`rounded-xl px-4 py-3 active:opacity-80 ${primary ? BRASS_BUTTON_CLASS : GHOST_BUTTON_CLASS} ${
        disabled ? "opacity-40" : ""
      }`}
    >
      {/* RN Text doesn't inherit color from the Pressable: set it here. */}
      <Text className={`text-center font-inter-semibold ${primary ? "text-z-ink" : "text-z-sage-light"}`}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Route guard: outside dev builds (and without EXPO_PUBLIC_ZETA_V2=1) the screen never mounts. */
export default function V2DebugRoute() {
  if (!V2_DEBUG_ENABLED) return <Redirect href="/" />;
  return <V2DebugScreen />;
}

function V2DebugScreen() {
  const { userId: authUserId } = useAuth();
  const userId = authUserId ?? LOCAL_USER;
  const [snapshot, setSnapshot] = useState<Snapshot>({ balance: null, note: null, pending: 0 });
  const [lastCommand, setLastCommand] = useState<CommandEnvelope | null>(null);
  const [lastTxId, setLastTxId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<CommandResult | null>(null);
  const [checks, setChecks] = useState<SelfTestCheck[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { driver } = await getV2Database();
    const s = createSqlStorage(driver);
    const account = await s.getAccount(userId, TEST_ACCOUNT);
    const tx = lastTxId ? await s.getTransaction(userId, lastTxId) : null;
    const [{ n }] = await driver.query<{ n: number }>("SELECT count(*) AS n FROM outbox WHERE state = 'pending'");
    setSnapshot({ balance: account?.currentBalance ?? null, note: tx?.notes ?? null, pending: Number(n) });
  }, [userId, lastTxId]);

  useEffect(() => {
    refresh().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [refresh]);

  const act = (fn: () => Promise<void>) => async () => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // Test fixture only: there is no account command yet, so the debug account is seeded directly.
  const createAccount = act(async () => {
    const { driver } = await getV2Database();
    await driver.query("INSERT OR IGNORE INTO accounts (id, user_id, current_balance) VALUES (?, ?, ?)", [
      TEST_ACCOUNT, userId, 100000,
    ]);
  });

  const capture = act(async () => {
    const transactionId = Crypto.randomUUID().toLowerCase();
    const { command, result } = await runLocalCommand({
      type: "captureManualTransaction",
      userId,
      payload: {
        transactionId, accountId: TEST_ACCOUNT, amount: 25000, direction: "OUTFLOW",
        currencyCode: "COP", date: toColombiaDateString(), description: "Prueba motor v2",
      },
    });
    setLastCommand(command);
    setLastTxId(transactionId);
    setLastResult(result);
  });

  const replay = act(async () => {
    if (!lastCommand) throw new Error("Primero anota un gasto");
    setLastResult(await replayLocalCommand(lastCommand));
  });

  const notesOutOfOrder = act(async () => {
    if (!lastTxId) throw new Error("Primero anota un gasto");
    const now = Date.now();
    await runLocalCommand({ type: "setTransactionNote", userId, payload: { transactionId: lastTxId, notes: "Nota nueva" } });
    // An edit made a minute earlier on another device arrives late: it must lose.
    const { driver } = await getV2Database();
    const late: CommandEnvelope = {
      id: Crypto.randomUUID().toLowerCase(), type: "setTransactionNote", userId, deviceId: "otro-dispositivo",
      clientTs: new Date(now - 60_000).toISOString(), payload: { transactionId: lastTxId, notes: "Nota vieja" },
    };
    setLastResult(await applyAndEnqueue(driver, late, { hash: expoSha256 }));
  });

  const reset = act(async () => {
    await resetV2Database();
    setLastCommand(null);
    setLastTxId(null);
    setLastResult(null);
  });

  const selfTest = act(async () => {
    setChecks(await runSelfTest());
  });

  const skipped = checks?.filter((c) => c.skipped).length ?? 0;
  const passed = checks?.filter((c) => c.ok && !c.skipped).length ?? 0;

  const format = (n: number | null) =>
    n == null ? "—" : n.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  return (
    <View className="flex-1 bg-background">
      <MobileHeader variant="sub" title="Motor v2 (debug)" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: MOBILE_TAB_BAR_CLEARANCE }}>
        <View className={`${PANEL_SURFACE_CLASS} p-4 gap-1`}>
          <Text className="font-inter text-muted-foreground">Saldo de la cuenta de prueba</Text>
          <Text className="font-inter-semibold text-2xl text-foreground">{format(snapshot.balance)}</Text>
          <Text className="font-inter text-foreground">Nota del último gasto: {snapshot.note ?? "—"}</Text>
          <Text className="font-inter text-foreground">Comandos en cola: {snapshot.pending}</Text>
          {lastResult && (
            <Text className="font-inter text-xs text-muted-foreground">Último resultado: {JSON.stringify(lastResult)}</Text>
          )}
          {error && <Text className="font-inter text-xs text-z-expense">{error}</Text>}
        </View>

        <Action label="Crear cuenta de prueba (100.000)" onPress={createAccount} disabled={busy} />
        <Action label="Anotar gasto de 25.000" onPress={capture} primary disabled={busy} />
        <Action label="Repetir el último comando" onPress={replay} disabled={busy} />
        <Action label="Nota nueva y luego una vieja" onPress={notesOutOfOrder} disabled={busy} />
        <Action label="Autoprueba" onPress={selfTest} primary disabled={busy} />
        <Action label="Borrar base v2" onPress={reset} disabled={busy} />

        {busy && <ActivityIndicator color={COLORS.brass} accessibilityLabel="Cargando" />}

        {checks && (
          <View className={`${PANEL_SURFACE_CLASS} p-4 gap-2`}>
            <Text className="font-inter-semibold text-foreground">
              Autoprueba: {passed} de {checks.length - skipped} bien
              {skipped > 0 ? ` · ${skipped} no aplica aquí` : ""}
            </Text>
            {checks.map((c) => (
              <View key={c.name}>
                <Text
                  className={`font-inter ${
                    c.skipped ? "text-muted-foreground" : c.ok ? "text-foreground" : "text-z-expense"
                  }`}
                >
                  {c.skipped ? "No aplica" : c.ok ? "Bien" : "Falla"} · {c.name}
                </Text>
                {c.detail && <Text className="font-inter text-xs text-muted-foreground">{c.detail}</Text>}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
