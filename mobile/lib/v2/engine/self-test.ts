import * as Crypto from "expo-crypto";
import * as SQLite from "expo-sqlite";
import { applyAndEnqueue, createSqlStorage, type CommandEnvelope } from "@zeta/shared";
import { deleteDatabaseFiles, openKeyed } from "./database";
import { expoSha256 } from "./run-local";
import { createExpoSqliteDriver } from "./sqlite-driver";
import { toHex } from "./secrets";

export type SelfTestCheck = { name: string; ok: boolean; detail?: string };

const FILE = "zeta-v2-selftest.db";
const USER = "11111111-1111-4111-8111-111111111111";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";
const CENTS_ACCOUNT = "33333333-3333-4333-8333-333333333333";

const uuid = () => Crypto.randomUUID().toLowerCase();

function eq(actual: unknown, expected: unknown, what: string): void {
  if (actual !== expected) throw new Error(`${what}: esperado ${String(expected)}, obtenido ${String(actual)}`);
}

/**
 * Runs the engine's key contract scenarios on the real device database
 * (expo-sqlite + SQLCipher), on a throwaway keyed file that is deleted after.
 */
export async function runSelfTest(): Promise<SelfTestCheck[]> {
  const checks: SelfTestCheck[] = [];
  const check = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      checks.push({ name, ok: true });
    } catch (e) {
      checks.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  };

  await deleteDatabaseFiles(FILE);
  const db = await openKeyed(FILE, toHex(await Crypto.getRandomBytesAsync(32)));
  const driver = createExpoSqliteDriver(db);
  const s = createSqlStorage(driver);
  const run = (cmd: CommandEnvelope) => applyAndEnqueue(driver, cmd, { hash: expoSha256 });
  const balance = async (id = ACCOUNT) => (await s.getAccount(USER, id))?.currentBalance;
  const queued = async () =>
    Number((await driver.query<{ n: number }>("SELECT count(*) AS n FROM outbox"))[0].n);
  const capture = (transactionId: string, amount: number, id = uuid()): CommandEnvelope => ({
    id, type: "captureManualTransaction", userId: USER, deviceId: "autoprueba",
    clientTs: new Date().toISOString(),
    payload: { transactionId, accountId: ACCOUNT, amount, direction: "OUTFLOW", currencyCode: "COP", date: "2026-09-30", description: "Autoprueba" },
  });
  const note = (transactionId: string, id: string, clientTs: string, notes: string): CommandEnvelope => ({
    id, type: "setTransactionNote", userId: USER, deviceId: "autoprueba", clientTs, payload: { transactionId, notes },
  });

  try {
    await driver.query("INSERT INTO accounts (id, user_id, current_balance) VALUES (?, ?, ?), (?, ?, ?)", [
      ACCOUNT, USER, 100000, CENTS_ACCOUNT, USER, 0,
    ]);
    const tx = uuid();
    const first = capture(tx, 25000);

    await check("Un comando repetido se aplica una sola vez", async () => {
      await run(first);
      eq((await run(first)).replayed, true, "repetido");
      eq(await balance(), 75000, "saldo");
      eq(await queued(), 1, "en cola");
    });

    await check("El mismo movimiento con otro comando es duplicado", async () => {
      eq((await run(capture(tx, 30000))).status, "duplicate", "estado");
      eq(await balance(), 75000, "saldo");
    });

    await check("Gana la nota más reciente aunque llegue primero", async () => {
      await run(note(tx, uuid(), "2026-09-30T17:00:00.000Z", "nueva"));
      eq((await run(note(tx, uuid(), "2026-09-30T16:00:00.000Z", "vieja"))).status, "superseded", "estado");
      eq((await s.getTransaction(USER, tx))?.notes, "nueva", "nota");
    });

    await check("Misma hora: decide el id del comando", async () => {
      const ts = "2026-09-30T18:00:00.000Z";
      await run(note(tx, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", ts, "gana b"));
      await run(note(tx, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", ts, "pierde a"));
      eq((await s.getTransaction(USER, tx))?.notes, "gana b", "nota");
    });

    await check("El saldo queda en centavos (0,1 + 0,2 = 0,3)", async () => {
      await s.adjustAccountBalance(USER, CENTS_ACCOUNT, 0.1);
      await s.adjustAccountBalance(USER, CENTS_ACCOUNT, 0.2);
      eq(await balance(CENTS_ACCOUNT), 0.3, "saldo");
    });

    await check("Un error deshace todo el comando", async () => {
      await driver
        .transaction(async (t) => {
          await t.query("UPDATE accounts SET current_balance = 1 WHERE id = ?", [ACCOUNT]);
          throw new Error("falla a propósito");
        })
        .catch(() => undefined);
      eq(await balance(), 75000, "saldo");
    });

    await check("Un comando rechazado no entra a la cola", async () => {
      const before = await queued();
      eq((await run(capture(uuid(), -5))).status, "rejected", "estado");
      eq(await queued(), before, "en cola");
    });

    await check("Dos comandos a la vez no se mezclan", async () => {
      const before = await balance();
      await Promise.all([run(capture(uuid(), 1000)), run(capture(uuid(), 2000))]);
      eq(await balance(), (before ?? 0) - 3000, "saldo");
    });

    await check("El archivo no se puede leer sin la clave", async () => {
      const raw = await SQLite.openDatabaseAsync(FILE, { useNewConnection: true });
      let readable = false;
      try {
        await raw.getFirstAsync("SELECT count(*) FROM sqlite_master");
        readable = true;
      } catch {
        // expected: "file is not a database"
      } finally {
        await raw.closeAsync().catch(() => undefined);
      }
      eq(readable, false, "legible sin clave");
    });
  } finally {
    await db.closeAsync().catch(() => undefined);
    await deleteDatabaseFiles(FILE);
  }
  return checks;
}
