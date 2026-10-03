import { useState } from "react";
import { StyleSheet, View } from "react-native";
import type { CommandType } from "@zeta/shared";
import { ONBOARDING_KEYS, parseLocal, readLocal, remember, rememberJson } from "../../lib/v2/local-state";
import { ExtractoPath, type ExtractoResult } from "./onboarding/ExtractoPath";
import { Goals, PathChoice, type GoalId } from "./onboarding/Goals";
import { ManualPath, type ManualResult } from "./onboarding/ManualPath";
import { Tour } from "./onboarding/Tour";

/** Run one command; a Spanish problem or null. */
export type RunCommand = (type: CommandType, payload: unknown) => Promise<string | null>;

type Step = "tour" | "goals" | "path" | "extracto" | "manual";

/**
 * The first run (S10-3): Laura's tour → goals (optional) → statements
 * (recommended) or "Lo digo yo". Asks only what a first number needs; every
 * other piece is optional and left as a task on Hoy (S10-4). Saved at the end
 * as ordinary commands (they sync); the rest is phone-only memory.
 */
export function Onboarding({ run, onDone, userId, tourSeen }: { run: RunCommand; onDone: () => void; userId: string; tourSeen: boolean }) {
  const [step, setStep] = useState<Step>(tourSeen ? "goals" : "tour");
  const [goals, setGoals] = useState<GoalId[]>(["gastar"]);

  const runAll = async (commands: [CommandType, unknown][]): Promise<string | null> => {
    for (const [type, payload] of commands) {
      const problem = await run(type, payload);
      if (problem) return problem;
    }
    return null;
  };
  // UI memory never blocks the user: a failed write only costs a reminder.
  const keep = (p: Promise<void>) => p.catch((e) => console.warn("[v2 onboarding] local memory not saved", e));

  const finishManual = async (r: ManualResult) => {
    const problem = await runAll(r.commands);
    if (problem) return problem;
    await keep(rememberJson(userId, ONBOARDING_KEYS.pendingBills, r.pendingBills));
    await keep(remember(userId, ONBOARDING_KEYS.path, "manual"));
    onDone();
    return null;
  };
  const finishExtracto = async (r: ExtractoResult) => {
    const problem = await runAll(r.commands);
    if (problem) return problem;
    if (r.dismissed.length) {
      await keep((async () => {
        const key = ONBOARDING_KEYS.dismissedPagos;
        const had = parseLocal<string[]>((await readLocal(userId, [key])).get(key), []);
        await rememberJson(userId, key, [...new Set([...had, ...r.dismissed])]);
      })());
    }
    await keep(remember(userId, ONBOARDING_KEYS.path, "extracto"));
    onDone();
    return null;
  };

  return (
    <View style={styles.wrap}>
      {step === "tour" && <Tour onDone={() => { void keep(remember(userId, ONBOARDING_KEYS.tourSeen, "1")); setStep("goals"); }} />}
      {step === "goals" && (
        <Goals value={goals} onChange={setGoals} onNext={() => { void keep(rememberJson(userId, ONBOARDING_KEYS.goals, goals)); setStep("path"); }} />
      )}
      {step === "path" && <PathChoice onExtracto={() => setStep("extracto")} onManual={() => setStep("manual")} onBack={() => setStep("goals")} />}
      {step === "extracto" && <ExtractoPath userId={userId} onFinish={finishExtracto} onManual={() => setStep("manual")} />}
      {step === "manual" && <ManualPath onFinish={finishManual} onBack={() => setStep("path")} />}
    </View>
  );
}

const styles = StyleSheet.create({
  // On the sand itself: its own cards are the white surfaces.
  wrap: { paddingHorizontal: 4, paddingTop: 4, gap: 10 },
});
