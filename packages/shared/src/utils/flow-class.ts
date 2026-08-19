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

/**
 * Bump when the rules below change, so stored verdicts can be re-derived.
 *
 * A row's `flow_class_version` records which rules version produced its
 * verdict, so a backfill can find and re-derive everything below the current
 * one: `WHERE flow_class_version IS NOT NULL AND flow_class_version < N`.
 *
 * `flow_class_version IS NULL` means **not classifier-derived — do not
 * re-derive**. Two write paths set a class this module cannot express, because
 * the deciding fact is carried by nothing the classifier can see:
 *
 *   * a manual balance adjustment (a reconciliation plug, not a movement)
 *   * a personal-debt repayment (the counterparty is a person, not an account)
 *
 * Stamping those with a real version would be a lie with teeth: the next
 * version-keyed backfill would "correct" them to SPEND and INCOME, which is
 * exactly what those two sites exist to prevent. NULL keeps them out of its
 * WHERE clause.
 */
export const FLOW_CLASS_RULES_VERSION = 2;

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

/**
 * Value stored in `flow_class_effective` when a row has no verdict yet — the
 * column is `coalesce(flow_class_override, flow_class, 'UNCLASSIFIED')` and is
 * never NULL.
 */
export const UNCLASSIFIED = "UNCLASSIFIED";

/**
 * The allow-list for `.in("flow_class_effective", ...)` on any metrics query.
 *
 * Use a POSITIVE list, never `.not.in(NEUTRAL)`. Three reasons:
 *  1. `NOT IN` cannot seek on the (user_id, flow_class_effective, date) index —
 *     it degrades the class column to a filter and takes the date range with it.
 *  2. It fails closed: a 9th class added next quarter is simply not counted
 *     until someone decides where it belongs, instead of silently landing in
 *     spend. Failing open is what produced the $73M-vs-$13M discrepancy.
 *  3. No three-valued-logic trap if the column ever does go NULL.
 *
 * Safe for both directions: an OUTFLOW can never classify as INCOME or
 * DEBT_CREDIT, so one list covers spend-only, income-only and mixed queries.
 *
 * `UNCLASSIFIED` is included on purpose. Rows written by a path that does not
 * yet call `classifyFlow` — and every row belonging to a user whose backfill
 * has not run — keep behaving exactly as they do today. Drop it from this list
 * once every write path classifies, and add a data-quality check that counts
 * what is still stuck there.
 */
export const COUNTED_FLOW_CLASSES: readonly string[] = [
  "INCOME",
  "SPEND",
  "CASH_WITHDRAWAL",
  "BANK_FEE",
  UNCLASSIFIED,
];

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
 * Transfer-ish wording. In rules version 2 this is a CORROBORATING signal only:
 * it can confirm a structural match against one of the user's own liquid
 * accounts, but on its own it decides nothing. See the note below.
 */
const RE_SELF_TRANSFER =
  /^(transferencia|transferencias\s+a\s|traslado|envio\s+de\s+dinero)/;

/*
 * DEMOTED in rules version 2: `^transferencia` used to map to SELF_TRANSFER on
 * its own, at confidence 0.7.
 *
 * It was the same mistake this file already calls out for QR, one rail over. In
 * Colombia almost everything is paid BY transfer — rent, the vet, groceries,
 * the Uber driver — so the word says how the money moved, not who got it.
 * Movements between the user's own accounts are the rare case.
 *
 * Measured on production before removing it: 278 rows / $30.830.132 classified
 * SELF_TRANSFER, ZERO of them linked in-app, and 98% carrying one of two
 * generic bank templates (`TRANSFERENCIA CTA SUC VIRTUAL`, `TRANSFERENCIAS A
 * NEQUI`) that name no destination at all. Rows the user had categorised as
 * Mercado, Uber, Restaurantes and Mascotas were being dropped from spend.
 *
 * What makes the demotion safe is that it costs no coverage: genuine
 * own-account movements are caught STRUCTURALLY by matchOwnAccount() below,
 * which matches on mask or account name. Verified on production —
 * `Transferencia a Bancolombia VISA ****7022` resolves via mask, never needing
 * the wording at all.
 *
 * The wording is still required for the LIQUID branch, and deliberately so. A
 * bare structural match is conclusive for debt (money reaching a card you owe
 * on is a payment however it was phrased) but not for liquid: a merchant line
 * like `COMPRA EXITO 4398` can collide with an account's last-4 by accident,
 * and treating that as a transfer would erase a real purchase from spend —
 * exactly the silent erasure this module exists to stop. Structure AND wording
 * for liquid; structure alone for debt.
 */

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
  // QR is a merchant rail in practice, not a transfer.
  qr_transferencia: "SPEND",
  avance: "DEBT_DRAWDOWN",
  nomina: "INCOME",
  pago_recibido: "INCOME",
  pago_recibido_cuenta: "INCOME",
  qr_recibido: "INCOME",
  transferencia_recibida: "INCOME",
  // Bre-B key transfer received — same shape as transferencia_recibida, money
  // arriving on the user's own account. (PR #385)
  transferencia_recibida_llave: "INCOME",
  // "Compraste X en Y … asociada a T.Cred *NNNN" — the verb settles it. (PR #385)
  compra_asociada: "SPEND",
  //
  // DELIBERATELY ABSENT — mapping these would LOCK IN a verdict at 0.95 and
  // outrank the description rules, which is worse than the 0.6 default they
  // fall through to today. Same reasoning as `transferencia` below.
  //
  //   `factura_programada` — a scheduled bill can be a CREDIT-CARD bill, which
  //   is DEBT_PAYMENT, not SPEND. Mapping it to SPEND would hard-code the exact
  //   error this module exists to remove, and block `pago tarjeta` from firing.
  //
  //   `recarga` — topping up a Cívica transit card is consumption; topping up
  //   the user's own Nequi/Daviplata wallet is a SELF_TRANSFER. The parser
  //   cannot tell them apart, so neither should this map.
  //
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
  if (input.matchedAccountType) {
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
    // Any other match is money reaching another account this user owns:
    // savings to savings, or a balance transfer between two of their cards.
    // Neither is consumption — but require the wording to agree, so a merchant
    // line that merely collides with an account's last-4 stays a purchase.
    if (RE_SELF_TRANSFER.test(desc)) {
      return {
        flowClass: "SELF_TRANSFER",
        confidence: 1,
        reason: "structural:own_account",
      };
    }
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

// ─────────────────────────────────────────────────────────────────
// Destination match — resolving `matchedAccountType`
// ─────────────────────────────────────────────────────────────────

/** One of the user's own accounts, as seen by the destination matcher. */
export interface OwnAccountRef {
  id: string;
  accountType: string | null | undefined;
  /** Decrypted account name. */
  name?: string | null;
  /** Decrypted card/account mask; non-digits are stripped before matching. */
  mask?: string | null;
}

/**
 * Find which of the user's OWN accounts a description names, if any.
 *
 * This resolves `FlowClassInput.matchedAccountType`, and it is the rule that
 * catches the descriptions no verb can: `bancolombia prestamo ****7507` and
 * `lulo bank s a` name only the lender, so text matching alone files them as
 * ordinary spend. Structurally they are payments — money leaving a liquid
 * account toward an account the same user owns and owes on.
 *
 * ALL account types are candidates, not just debt. That widening is what lets
 * the `^transferencia` text rule be retired: a genuine savings-to-savings move
 * is now recognised by naming the destination account rather than by the word
 * "transferencia", which in Colombia says how the money moved and not who
 * received it. Callers must therefore pass EVERY account the user owns — hand
 * it only the debt ones and real transfers silently become SPEND.
 *
 * Mirror of the `dest` LATERAL in `zeta_flow_class_candidates`
 * (20260806150000). The two implementations must agree row for row: SQL does
 * the backfill, this does every write from here on, and a disagreement means
 * the same movement is classified one way in history and another going forward.
 */
export function matchOwnAccount(
  description: string | null | undefined,
  accounts: readonly OwnAccountRef[],
  ownAccountId: string | null | undefined,
): OwnAccountRef | null {
  const desc = normalize(description);
  if (!desc) return null;

  const padded = " " + desc + " ";
  let best: { account: OwnAccountRef; byMask: boolean; nameLength: number } | null = null;

  for (const account of accounts) {
    // Card statements print the card's own last-4 on every line. Without this
    // guard every purchase self-matches as a payment to itself and the card's
    // entire spend disappears from the totals.
    if (account.id === ownAccountId) continue;

    const mask = (account.mask ?? "").replace(/[^0-9]/g, "");
    const name = normalize(account.name);

    let byMask = false;
    if (mask.length >= 4 && new RegExp(`(^|[^0-9])${mask}([^0-9]|$)`).test(desc)) {
      // Digit-adjacency matters: a bare `7507` also sits inside the amount
      // `175075`.
      byMask = true;
    } else if (!(name.length >= 4 && padded.includes(" " + name + " "))) {
      // Whole-token, and >= 4 chars. A 2-character name like "Nu" is
      // deliberately unmatchable — it would fire on "menu", "nuevo", "nube".
      continue;
    }

    const candidate = { account, byMask, nameLength: name.length };
    if (
      best === null ||
      (candidate.byMask && !best.byMask) ||
      (candidate.byMask === best.byMask && candidate.nameLength > best.nameLength)
    ) {
      best = candidate;
    }
  }

  return best?.account ?? null;
}
