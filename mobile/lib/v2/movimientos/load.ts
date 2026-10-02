import {
  buildInicio,
  inicioSince,
  readInicioData,
  type InicioAccount,
  type PayCycle,
  type StoredTransaction,
} from "@zeta/shared";
import { toColombiaDateString } from "../../utils/date";
import { getV2Database } from "../engine/database";

export interface LoadedMovimientos {
  today: string;
  /** Newest first: this cycle and the ones the phone still holds whole. */
  cycles: PayCycle[];
  transactions: StoredTransaction[];
  accounts: InicioAccount[];
}

/**
 * Movimientos from the phone's own v2 database (same read as Inicio, so the
 * cycles match). Local only, never the network. Null until the first-run
 * questions are answered (there's no cycle to show yet).
 */
export async function loadMovimientos(userId: string, now: Date = new Date()): Promise<LoadedMovimientos | null> {
  const { driver } = await getV2Database();
  const today = toColombiaDateString(now);
  const data = await readInicioData(driver, userId, inicioSince(today));
  const state = buildInicio({ today, now: now.toISOString(), ...data });
  if (state.status !== "ready") return null;
  return { today, cycles: state.cycles, transactions: data.transactions, accounts: data.accounts };
}
