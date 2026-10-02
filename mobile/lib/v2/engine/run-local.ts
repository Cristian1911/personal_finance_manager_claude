import * as Crypto from "expo-crypto";
import {
  applyAndEnqueue,
  type CommandEnvelope,
  type CommandResult,
  type CommandType,
  type HashFn,
} from "@zeta/shared";
import { getV2Database } from "./database";
import { getDeviceId } from "./secrets";

/** Same lower-case hex SHA-256 as the server's WebCrypto default. */
export const expoSha256: HashFn = (payload) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, payload);

const written = new Set<() => void>();
/** Called after every queued local command (the sync scheduler listens). */
export function onLocalCommand(listener: () => void): () => void {
  written.add(listener);
  return () => { written.delete(listener); };
}

/** Runs a user action on the phone and queues it; never touches the network. */
export async function runLocalCommand(input: {
  type: CommandType;
  userId: string;
  payload: unknown;
  /** A batch (a statement's rows): the caller notifies once at the end with notifyLocalWrite(). */
  quiet?: boolean;
}): Promise<{ command: CommandEnvelope; result: CommandResult }> {
  const { driver } = await getV2Database();
  const command: CommandEnvelope = {
    id: Crypto.randomUUID().toLowerCase(),
    type: input.type,
    userId: input.userId,
    deviceId: await getDeviceId(),
    clientTs: new Date().toISOString(),
    payload: input.payload,
  };
  const result = await applyAndEnqueue(driver, command, { hash: expoSha256 });
  if (result.status !== "rejected" && !input.quiet) for (const l of written) l();
  return { command, result };
}

/** After a quiet batch: tell the screens (and sync) once. */
export function notifyLocalWrite(): void {
  for (const l of written) l();
}

/** Sends an existing command again (debug: proves replays are no-ops). */
export async function replayLocalCommand(command: CommandEnvelope): Promise<CommandResult> {
  const { driver } = await getV2Database();
  return applyAndEnqueue(driver, command, { hash: expoSha256 });
}
