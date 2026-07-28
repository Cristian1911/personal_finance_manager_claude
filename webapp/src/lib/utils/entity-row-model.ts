import { differenceInCalendarDays } from "date-fns";
import { formatCurrency } from "@/lib/utils/currency";
import { isDebtAccountType } from "@/lib/utils/account-balance";
import type { AccountType, CurrencyCode } from "@/types/domain";

/** Utilización de cupo a partir de la cual la fila pide atención. */
const UTILIZATION_ALERT_THRESHOLD = 0.75;
/** Días sin sincronizar antes de marcar el saldo como viejo. */
const STALE_BALANCE_DAYS = 10;

export type RowTone = "brass" | "alert" | "income";
export type TrailingTone = "debt" | "income" | "neutral";
/** Qué ofrece la expansión como acción principal. */
export type RowPrimaryAction = "none" | "abonar" | "archive";

export interface RowGauge {
  /** 0–100+. La barra recorta a 100 al pintar; el número puede pasarse. */
  pct: number;
  label: string;
  tone: RowTone;
}

export interface AccountRowModel {
  gauge: RowGauge | null;
  /** Partes que se unen con " · " bajo el título. */
  meta: string[];
  trailing: { value: string; caption: string; tone: TrailingTone };
  primaryAction: RowPrimaryAction;
}

/** Subconjunto de `Account` del que depende la derivación. */
export interface DerivableAccount {
  account_type: AccountType;
  currency_code: CurrencyCode;
  current_balance: number;
  credit_limit: number | null;
  monthly_payment?: number | null;
  interest_rate?: number | null;
  last_synced_at?: string | null;
}

/**
 * Traduce una cuenta a lo que la fila necesita pintar. Puro a propósito: la
 * decisión de qué medidor y qué acción mostrar es la parte con reglas, y
 * separarla del componente es lo que la hace testeable — el repo no tiene
 * jsdom, así que un test que renderice React no correría.
 *
 * `today` se inyecta en vez de leer el reloj: leerlo aquí lo haría no
 * determinista en tests, y en un componente rompería la hidratación.
 */
export function deriveAccountRow(
  account: DerivableAccount,
  opts: { today: string },
): AccountRowModel {
  const isDebt = isDebtAccountType(account.account_type);
  const isCreditCard = account.account_type === "CREDIT_CARD";
  const hasLimit = account.credit_limit != null && account.credit_limit > 0;

  let gauge: RowGauge | null = null;
  if (isDebt && hasLimit) {
    const limit = account.credit_limit as number;
    if (isCreditCard) {
      const pct = (account.current_balance / limit) * 100;
      gauge = {
        pct,
        label: "uso",
        tone: pct >= UTILIZATION_ALERT_THRESHOLD * 100 ? "alert" : "brass",
      };
    } else {
      // Un préstamo mide progreso, no consumo: lo interesante es cuánto va
      // saldado, no cuánto queda.
      const paid = Math.max(0, limit - account.current_balance);
      gauge = { pct: (paid / limit) * 100, label: "pagado", tone: "income" };
    }
  }

  const meta: string[] = [];
  if (account.monthly_payment != null && account.monthly_payment > 0) {
    meta.push(
      `cuota ${formatCurrency(account.monthly_payment, account.currency_code)}`,
    );
  }
  if (account.interest_rate != null && account.interest_rate > 0) {
    meta.push(`${account.interest_rate.toFixed(1)}% EA`);
  }
  if (account.last_synced_at) {
    const days = differenceInCalendarDays(
      new Date(`${opts.today}T12:00:00`),
      new Date(account.last_synced_at),
    );
    if (days >= STALE_BALANCE_DAYS) meta.push(`sin actualizar ${days}d`);
  }

  const settled = isDebt && account.current_balance === 0;
  const trailingTone: TrailingTone = !isDebt
    ? "neutral"
    : settled
      ? "income"
      : "debt";

  return {
    gauge,
    meta,
    trailing: {
      value: formatCurrency(account.current_balance, account.currency_code),
      caption: isDebt ? (isCreditCard ? "usado" : "saldo") : "disponible",
      tone: trailingTone,
    },
    primaryAction: !isDebt ? "none" : settled ? "archive" : "abonar",
  };
}
