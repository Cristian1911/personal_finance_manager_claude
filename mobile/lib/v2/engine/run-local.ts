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

/** Runs a user action on the phone and queues it; never touches the network. */
export async function runLocalCommand(input: {
  type: CommandType;
  userId: string;
  payload: unknown;
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
  return { command, result: await applyAndEnqueue(driver, command, { hash: expoSha256 }) };
}

/** Sends an existing command again (debug: proves replays are no-ops). */
export async function replayLocalCommand(command: CommandEnvelope): Promise<CommandResult> {
  const { driver } = await getV2Database();
  return applyAndEnqueue(driver, command, { hash: expoSha256 });
}
