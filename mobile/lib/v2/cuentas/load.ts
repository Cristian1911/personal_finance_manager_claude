import { buildInicio, createSqlStorage, cuentasView, inicioSince, readInicioData, type CuentasView, type InicioAccount, type StoredTransaction } from "@zeta/shared";
import { toColombiaDateString } from "../../utils/date";
import { getV2Database } from "../engine/database";
import { readUsdRate } from "../local-state";

export interface LoadedCuentas {
  view: CuentasView;
  accounts: InicioAccount[];
  /** Recent movements (Inicio's window), for an account's "Movimientos" block. */
  transactions: StoredTransaction[];
  /** This cycle's first day, or null before the first-run questions. */
  cycleStart: string | null;
  /** Today's dollar as the last pull brought it (S10-14), for a card's USD part. */
  usdRate: { rate: number; at: string } | null;
}

/** Mis cuentas from the phone's v2 database. Local only. */
export async function loadCuentas(userId: string, now: Date = new Date()): Promise<LoadedCuentas> {
  const { driver } = await getV2Database();
  const today = toColombiaDateString(now);
  const data = await readInicioData(driver, userId, inicioSince(today));
  const usdRate = await readUsdRate(userId);
  const state = buildInicio({ today, now: now.toISOString(), ...data, usdRate: usdRate?.rate ?? null });
  const ready = state.status === "ready";
  return {
    view: cuentasView({ accounts: data.accounts }),
    accounts: data.accounts,
    transactions: data.transactions,
    cycleStart: ready ? state.cycle.start : null,
    usdRate,
  };
}

/** One account with every detail (Editar cuenta). */
export async function loadAccount(userId: string, id: string) {
  const { driver } = await getV2Database();
  return createSqlStorage(driver).getAccount(userId, id);
}
