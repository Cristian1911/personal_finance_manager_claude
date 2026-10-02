import { applySnapshot, inicioSince, type CommandEnvelope, type CommandResult, type Snapshot } from "@zeta/shared";
import { supabase } from "../../supabase";
import { toColombiaDateString } from "../../utils/date";
import { notifyV2Change } from "../changes";
import { getV2Database } from "../engine/database";
import { V2_LOCAL_USER } from "../user";

const API = process.env.EXPO_PUBLIC_API_URL ?? "";
const BATCH = 50;
/** After this many failed tries a command is set aside ('dead') so it can't block everything after it. */
export const MAX_ATTEMPTS = 5;

export type SyncOutcome = "synced" | "pending" | "offline" | "signed_out" | "error";

let running: Promise<SyncOutcome> | null = null;
let again = false;

/**
 * Sync (S9-4): push the outbox in order, then — only when it's empty, so no
 * local change can be lost — replace the phone's copy with the server's
 * snapshot. Single-flight (a request while running runs once more after);
 * never throws; local data stays usable offline.
 */
export function syncV2(userId: string): Promise<SyncOutcome> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    let outcome: SyncOutcome;
    do {
      again = false;
      outcome = await run(userId);
    } while (again);
    return outcome;
  })().finally(() => { running = null; });
  return running;
}

async function run(userId: string): Promise<SyncOutcome> {
  if (userId === V2_LOCAL_USER || !API) return "signed_out";
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token || data.session?.user.id !== userId) return "signed_out";
    const pushed = await push(userId, token);
    if (pushed !== "done") return pushed;
    return await pull(userId, token);
  } catch (e) {
    console.warn("[v2 sync] failed", e);
    return "offline";
  }
}

async function push(userId: string, token: string): Promise<"done" | SyncOutcome> {
  const { driver } = await getV2Database();
  for (;;) {
    const rows = await driver.query<{ command_id: string; type: string; device_id: string; client_ts: string; payload: string | null }>(
      `SELECT o.command_id, c.type, c.device_id, c.client_ts, c.payload
         FROM outbox o JOIN commands c ON c.id = o.command_id AND c.user_id = o.user_id
        WHERE o.user_id = ? AND o.state = 'pending' ORDER BY o.seq LIMIT ?`,
      [userId, BATCH],
    );
    if (rows.length === 0) return "done";
    const commands: CommandEnvelope[] = rows.map((r) => ({
      id: r.command_id, type: r.type as CommandEnvelope["type"], userId, deviceId: r.device_id, clientTs: r.client_ts,
      payload: r.payload == null ? null : JSON.parse(r.payload),
    }));
    let res: Response;
    try {
      res = await fetch(`${API}/api/v2/commands`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ commands }),
      });
    } catch {
      return "offline";
    }
    if (res.status === 401) return "signed_out";
    if (!res.ok) {
      await failed(rows[0].command_id, `HTTP ${res.status}`);
      return "error";
    }
    const body = (await res.json()) as { results: { id: string; result: CommandResult }[]; failed?: { id: string; error: string } };
    await driver.transaction(async (tx) => {
      for (const r of body.results) {
        await tx.query("UPDATE outbox SET state = 'acked', server_result = ? WHERE command_id = ?", [JSON.stringify(r.result), r.id]);
      }
    });
    if (body.failed) {
      await failed(body.failed.id, body.failed.error);
      return "pending";
    }
  }
}

async function failed(commandId: string, error: string) {
  const { driver } = await getV2Database();
  await driver.query(
    `UPDATE outbox SET attempts = attempts + 1, last_error = ?,
       state = CASE WHEN attempts + 1 >= ? THEN 'dead' ELSE state END
     WHERE command_id = ?`,
    [error, MAX_ATTEMPTS, commandId],
  );
}

export interface SyncProblem {
  commandId: string;
  type: string;
  /** Spanish, for people. */
  error: string;
  state: "dead" | "rejected";
}

/**
 * Changes that didn't make it to the account (Revisar): set aside after
 * repeated failures, or refused by the server (e.g. the account was archived
 * on another phone). Their local effect is gone after the next pull.
 */
export async function syncProblems(userId: string): Promise<SyncProblem[]> {
  const { driver } = await getV2Database();
  const rows = await driver.query<{ command_id: string; type: string; state: string; last_error: string | null; server_result: string | null }>(
    `SELECT o.command_id, c.type, o.state, o.last_error, o.server_result
       FROM outbox o JOIN commands c ON c.id = o.command_id AND c.user_id = o.user_id
      WHERE o.user_id = ? AND (o.state = 'dead' OR (o.state = 'acked' AND o.server_result LIKE '%"status":"rejected"%'))
      ORDER BY o.seq DESC LIMIT 20`,
    [userId],
  );
  return rows.map((r) => {
    if (r.state === "dead") return { commandId: r.command_id, type: r.type, state: "dead" as const, error: r.last_error ?? "No se pudo guardar." };
    const result = JSON.parse(r.server_result ?? "{}") as CommandResult;
    return { commandId: r.command_id, type: r.type, state: "rejected" as const, error: result.error ?? "Tu cuenta no aceptó este cambio." };
  });
}

async function pull(userId: string, token: string): Promise<SyncOutcome> {
  const since = inicioSince(toColombiaDateString());
  let res: Response;
  try {
    res = await fetch(`${API}/api/v2/snapshot?since=${since}`, { headers: { authorization: `Bearer ${token}` } });
  } catch {
    return "offline";
  }
  if (res.status === 401) return "signed_out";
  if (!res.ok) return "error";
  const { snapshot } = (await res.json()) as { snapshot: Snapshot };
  const { driver } = await getV2Database();
  // Check and replace in one transaction: a command written meanwhile would be wiped otherwise.
  const applied = await driver.transaction(async (tx) => {
    const [{ n }] = await tx.query<{ n: number }>("SELECT COUNT(*) AS n FROM outbox WHERE user_id = ? AND state = 'pending'", [userId]);
    if (n > 0) return false;
    await applySnapshot(tx, userId, snapshot, since);
    return true;
  });
  if (!applied) return "pending";
  notifyV2Change();
  return "synced";
}
