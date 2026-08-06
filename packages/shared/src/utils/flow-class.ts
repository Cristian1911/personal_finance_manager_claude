/**
 * Flow classification — is this movement consumption, or balance-sheet shuffling?
 *
 * Category and flow class are **orthogonal axes**. Category answers "what did I
 * buy"; flow class answers "did I buy anything at all". Neither is derived from
 * the other.
 *
 * Conflating them is what produced the misreporting this module exists to fix:
 * paying a credit card from savings moves money to a card the user already owns,
 * so counting it as spend double-counts the original purchases. Measured on real
 * data, April 2026 reported $73.480.217 of outflow when actual consumption was
 * $13.351.155 — the rest was card payments, transfers and cash advances. On the
 * income side a $22.441.478 loan disbursement was counted as income.
 *
 * Deliberately NOT an input: `category_id`. The user re-categorizes constantly,
 * so depending on it would make the class go stale from *data* changes and not
 * just rule changes. A user's "this is actually a card payment" correction
 * belongs in `flow_class_override`, not smuggled in through a category pick.
 *
 * Mirrored in SQL by `zeta_mcp_flow_class` for backfill and MCP analysis. This
 * TypeScript implementation is canonical; keep the two in step.
 */

/** Bump when the rules below change, so stored verdicts can be re-derived. */
export const FLOW_CLASS_RULES_VERSION = 1;

export type FlowClass =
  /** Real income — INFLOW to a non-debt account. */
  | "INCOME"
  /** Real day-to-day consumption. */
  | "SPEND"
  /** OUTFLOW that pays down a card or loan. Not consumption. */
  | "DEBT_PAYMENT"
  /** INFLOW landing on a card/loan account — a payment arriving, or a refund. */
  | "DEBT_CREDIT"
  /** New credit taken: a cash advance, or a loan disbursed into a liquid account. */
  | "DEBT_DRAWDOWN"
  /** Movement between the user's own accounts. Not consumption. */
  | "SELF_TRANSFER"
  /** ATM cash. Real money out, but the destination is unknown. */
  | "CASH_WITHDRAWAL"
  /** Taxes and bank charges. */
  | "BANK_FEE";

/** Classes that count toward "what I spent". */
export const SPEND_CLASSES: ReadonlySet<FlowClass> = new Set<FlowClass>([
  "SPEND",
  "CASH_WITHDRAWAL",
  "BANK_FEE",
]);

/** Classes that count toward "what I earned". */
export const INCOME_CLASSES: ReadonlySet<FlowClass> = new Set<FlowClass>(["INCOME"]);

/**
 * Classes that count toward neither. They move money the user already had (or
 * already owed) and must be excluded from both sides or the totals double-count.
 */
export const NEUTRAL_CLASSES: ReadonlySet<FlowClass> = new Set<FlowClass>([
  "DEBT_PAYMENT",
  "DEBT_CREDIT",
  "DEBT_DRAWDOWN",
  "SELF_TRANSFER",
]);

export function isSpendClass(flowClass: string | null | undefined): boolean {
  return flowClass != null && SPEND_CLASSES.has(flowClass as FlowClass);
}

export function isIncomeClass(flowClass: string | null | undefined): boolean {
  return flowClass != null && INCOME_CLASSES.has(flowClass as FlowClass);
}

export function isNeutralClass(flowClass: string | null | undefined): boolean {
  return flowClass != null && NEUTRAL_CLASSES.has(flowClass as FlowClass);
}

const DEBT_ACCOUNT_TYPES = new Set(["CREDIT_CARD", "LOAN"]);

function isDebtAccount(accountType: string | null | undefined): boolean {
  return accountType != null && DEBT_ACCOUNT_TYPES.has(accountType);
}

// ─────────────────────────────────────────────────────────────────
// Description patterns (Colombian banks)
// ─────────────────────────────────────────────────────────────────
// Run against a lowercased, accent-stripped description.

/** Cash advance taken on a card — creates debt, is not a purchase. */
const RE_CASH_ADVANCE = /^(avance|adelanto)|avance\s+(sucursal|cajero)/;

/** A loan paid out INTO a liquid account. Counted as income before this existed. */
const RE_DISBURSEMENT = /desembolso\s+de\s+credito|desembolso\s+prestamo|abono\s+desembolso/;

/** Paying down a card or loan. */
const RE_DEBT_PAYMENT =
  /pago\s+(suc\s+virt\s+)?tc\b|pago\s+tarjeta|pago\s+alternativo\s+tarj|abono\s+a\s+capital|abono\s+mora|pago\s+cuota|pago\s+pse\s+nu\b|mora\s+tarjeta|renegociado|ampliacion\s+de\s+plazo/;

const RE_CASH_WITHDRAWAL = /retiro\s+(cajero|atm|corresponsal)/;

// `cuota\s+de?\s*manejo` was broken: `de?` requires a literal "d", so it matched
// "cuota de manejo" but never the bare "cuota manejo" the banks actually print.
// The group makes "de" optional as a unit.
const RE_BANK_FEE =
  /impto\s+gobierno|4x1000|cuota\s+(de\s+)?manejo|comision|comision\s+avance|interes(es)?\s+corriente|interes(es)?\s+mora|cobro\s+transf|ajuste\s+interes/;

/**
 * Bare transfers with no merchant attached.
 *
 * QR transfers are deliberately excluded: in Colombia `TRANSF QR`/`PAGO QR` are
 * overwhelmingly merchant payments, not movements between own accounts. Treating
 * them as transfers would erase real spending from the totals.
 */
const RE_SELF_TRANSFER =
  /^(transferencia|transferencias\s+a\s|traslado|envio\s+de\s+dinero)/;

/**
 * Intent hints emitted by the Bancolombia email parser (`pattern_type`).
 * The parser already distinguishes these 15 cases and today throws them away.
 */
export const EMAIL_PATTERN_TO_FLOW: Readonly<Record<string, FlowClass>> = {
  retiro: "CASH_WITHDRAWAL",
  compra_debito: "SPEND",
  compra_credito: "SPEND",
  qr_pago: "SPEND",
  boton_bancolombia: "SPEND",
  pago_pse: "SPEND",
  bre_b: "SPEND",
  // See RE_SELF_TRANSFER — QR is a merchant rail in practice.
  qr_transferencia: "SPEND",
  avance: "DEBT_DRAWDOWN",
  nomina: "INCOME",
  pago_recibido: "INCOME",
  pago_recibido_cuenta: "INCOME",
  qr_recibido: "INCOME",
  transferencia_recibida: "INCOME",
  // `transferencia` (outbound, unqualified) is intentionally absent: without a
  // counterpart it cannot be told from a merchant payment. Falls through to the
  // description rules.
};

/** Statement-level hints from the Python PDF parsers (`source_hint`). */
export const PY_HINT_TO_FLOW: Readonly<Record<string, FlowClass>> = {
  PAYMENT: "DEBT_PAYMENT",
  PURCHASE: "SPEND",
  CASH_ADVANCE: "DEBT_DRAWDOWN",
  INTEREST: "BANK_FEE",
  FEE: "BANK_FEE",
  DISBURSEMENT: "DEBT_DRAWDOWN",
  INSTALLMENT: "SPEND",
};

export interface FlowClassInput {
  direction: "INFLOW" | "OUTFLOW";
  /** Account the movement is recorded against. */
  accountType: string | null | undefined;
  /** Merchant name, clean description, or raw bank description. */
  description: string | null | undefined;
  /** Set when this row is one leg of a linked transfer. */
  transferGroupId?: string | null;
  /** Account type of the *other* leg, when the transfer is linked. */
  counterpartAccountType?: string | null;
  /**
   * Account type of one of the SAME user's OTHER accounts whose mask or name
   * appears in the description — i.e. the movement names where it went.
   *
   * Resolved by the caller from accounts it already holds (AppDataProvider, the
   * import wizard's statement mapping), never fetched here: `accounts.mask` and
   * `.name` are encrypted, so looking them up would make this function impure
   * and unusable in an index or a generated column.
   *
   * Callers MUST exclude the transaction's own account. Card statements print
   * the card's own last-4 on every line, so without that guard every purchase
   * would self-match and be filed as a payment to itself.
   */
  matchedAccountType?: string | null;
  /** Raw parser signal — `pattern_type` (email) or `source_hint` (PDF). */
  sourcePattern?: string | null;
}

/**
 * Who wrote `flow_class_override`.
 *
 * `USER` is an explicit correction in the app. `CATEGORY_SEED` is the one-time
 * backfill from the user's "Cuota crédito" / "Tarjeta de crédito" category — a
 * strong prior, not an assertion, and safe to clear once the classifier agrees
 * on its own. Only `USER` may render as a user correction in the UI.
 */
export type FlowClassOverrideSource = "USER" | "CATEGORY_SEED";

export interface FlowClassResult {
  flowClass: FlowClass;
  /** 1.0 = structural (account type, linked transfer); lower = inferred from text. */
  confidence: number;
  /** Which rule fired. Kept for auditability when a verdict looks wrong. */
  reason: string;
}

function normalize(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Classify a movement. Pure — safe to call from a server action, a Next.js
 * `"use cache"` function, or React Native.
 */
export function classifyFlow(input: FlowClassInput): FlowClassResult {
  const desc = normalize(input.description);
  const isInflow = input.direction === "INFLOW";

  // 1. A parser told us outright. Most reliable signal available.
  const hint = input.sourcePattern;
  if (hint) {
    const mapped = EMAIL_PATTERN_TO_FLOW[hint] ?? PY_HINT_TO_FLOW[hint];
    if (mapped) {
      return { flowClass: mapped, confidence: 0.95, reason: `source_pattern:${hint}` };
    }
  }

  // 2. Linked transfer — the counterpart account decides what kind it is.
  //    Paying a card through the in-app transfer flow lands here.
  if (input.transferGroupId) {
    if (isInflow && isDebtAccount(input.accountType)) {
      return { flowClass: "DEBT_CREDIT", confidence: 1, reason: "linked:debt_leg" };
    }
    if (!isInflow && isDebtAccount(input.counterpartAccountType)) {
      return { flowClass: "DEBT_PAYMENT", confidence: 1, reason: "linked:pays_debt" };
    }
    return { flowClass: "SELF_TRANSFER", confidence: 1, reason: "linked:transfer" };
  }

  // 3. Cash advance — creates debt, never a purchase. Checked before the
  //    INFLOW/OUTFLOW split because it can be recorded either way.
  if (RE_CASH_ADVANCE.test(desc)) {
    return { flowClass: "DEBT_DRAWDOWN", confidence: 0.9, reason: "text:cash_advance" };
  }

  if (isInflow) {
    // Money landing on a card or loan: a payment arriving, or a refund.
    if (isDebtAccount(input.accountType)) {
      return { flowClass: "DEBT_CREDIT", confidence: 1, reason: "structural:inflow_to_debt" };
    }
    // A loan paid into a liquid account is new debt, not income. No structural
    // signal catches this — the account is a savings account — so it can only be
    // read off the description.
    if (RE_DISBURSEMENT.test(desc)) {
      return { flowClass: "DEBT_DRAWDOWN", confidence: 0.9, reason: "text:disbursement" };
    }
    return { flowClass: "INCOME", confidence: 0.8, reason: "structural:inflow" };
  }

  // OUTFLOW from here down.

  // Structural evidence beats wording: money leaving a liquid account toward an
  // account the user owns and owes on is a payment, however the bank phrased it.
  // This is what catches `bancolombia prestamo ****7507` and `lulo bank s a` —
  // descriptions that name only the lender and give no verb to match on.
  //
  // Placed AFTER the cash-advance rule on purpose: `avance ****7507` carries its
  // own card's mask and is a drawdown, not a payment.
  if (
    !isDebtAccount(input.accountType) &&
    isDebtAccount(input.matchedAccountType)
  ) {
    return {
      flowClass: "DEBT_PAYMENT",
      confidence: 1,
      reason: "structural:pays_own_debt_account",
    };
  }

  if (RE_DEBT_PAYMENT.test(desc)) {
    return { flowClass: "DEBT_PAYMENT", confidence: 0.9, reason: "text:debt_payment" };
  }
  if (RE_CASH_WITHDRAWAL.test(desc)) {
    return { flowClass: "CASH_WITHDRAWAL", confidence: 0.9, reason: "text:cash_withdrawal" };
  }
  if (RE_BANK_FEE.test(desc)) {
    return { flowClass: "BANK_FEE", confidence: 0.9, reason: "text:bank_fee" };
  }
  if (RE_SELF_TRANSFER.test(desc)) {
    return { flowClass: "SELF_TRANSFER", confidence: 0.7, reason: "text:transfer" };
  }

  return { flowClass: "SPEND", confidence: 0.6, reason: "default:outflow" };
}

/** Convenience: the class alone, for call sites that don't need the audit trail. */
export function flowClassOf(input: FlowClassInput): FlowClass {
  return classifyFlow(input).flowClass;
}

/**
 * Effective class for a stored row: an explicit user correction always wins over
 * the machine verdict.
 */
export function effectiveFlowClass(row: {
  flow_class?: string | null;
  flow_class_override?: string | null;
}): FlowClass | null {
  return (row.flow_class_override ?? row.flow_class ?? null) as FlowClass | null;
}
