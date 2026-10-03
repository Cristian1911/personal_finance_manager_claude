import { buildInicio, inicioSince, pagosView, readInicioData, type InicioAccount, type PagosView } from "@zeta/shared";
import { toColombiaDateString } from "../../utils/date";
import { getV2Database } from "../engine/database";
import { readUsdRate } from "../local-state";

export interface LoadedPagos {
  today: string;
  /** This cycle: what's due, paid or skipped. */
  now: PagosView;
  /** The next cycle, read-only preview. */
  next: PagosView;
  /** "Este ciclo · 30 sep–14 oct"-style range label pieces. */
  cycleEnd: string;
  accounts: InicioAccount[];
}

/** Pagos from the phone's v2 database (the same bills Inicio subtracts). Null before the first-run questions. */
export async function loadPagos(userId: string, now: Date = new Date()): Promise<LoadedPagos | null> {
  const { driver } = await getV2Database();
  const today = toColombiaDateString(now);
  const data = await readInicioData(driver, userId, inicioSince(today));
  const state = buildInicio({ today, now: now.toISOString(), ...data, usdRate: (await readUsdRate(userId))?.rate ?? null });
  if (state.status !== "ready") return null;
  const end = state.cycle.end;
  return {
    today,
    now: pagosView({ today, bills: state.bills.filter((b) => b.dueDate <= end) }),
    next: pagosView({ today, bills: state.bills.filter((b) => b.dueDate > end) }),
    cycleEnd: end,
    accounts: data.accounts,
  };
}
