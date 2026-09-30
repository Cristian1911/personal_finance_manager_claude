import type { IsoDate } from "./dates";

/**
 * Disponible: how much you can still spend until your next payday.
 *
 *   Disponible = Llega este ciclo − Por pagar − Ahorro − Ya salió (± ajustes)
 *   Por día    = Disponible ÷ días que faltan (incluye hoy), rounded down to $100
 *
 * Pure: no database, no clock. Rules: docs/mlp/10-build-plan.md §4, decisions
 * S3-0…S3-8, D5, D8; worked examples in docs/mlp/sessions/03-disponible.html.
 */

export interface DisponibleAccount {
  id: string;
  /** The user's choice (S3-0). Cards and loans never count. */
  countsInDisponible: boolean;
  /** Credit card or loan: a transfer to it is a payment, not savings. */
  isDebt?: boolean;
}

/**
 * How a movement affects Disponible; the caller classifies stored transactions.
 * - spend: debit/cash purchase, ATM withdrawal (S3-1), money lent, a shared purchase (full amount).
 * - payment: a bill, card bill, loan cuota or Tú debes (with obligationId), or an extra payment (without).
 * - income: other income. salary: replaces the expected salary. repayment: "Te pagaron".
 * - refund: nets against Ya salió. transfer: between own accounts (counterpartAccountId).
 * - ignored: a cash expense that relabels an ATM withdrawal (S3-1), a trip purchase (v1.1), excluded rows.
 */
export type MovementKind = "spend" | "payment" | "income" | "salary" | "repayment" | "refund" | "transfer" | "ignored";

export interface DisponibleMovement {
  id: string;
  accountId: string;
  date: IsoDate;
  /** Capture instant; only needed to place same-day movements around the first-cycle anchor. */
  at?: string;
  /** Always positive; `direction` says which way it went. */
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  kind: MovementKind;
  counterpartAccountId?: string;
  obligationId?: string;
  expectedIncomeId?: string;
  /** Foreign currency at the day's rate + 3%, until the PDF gives the exact COP. */
  approx?: boolean;
}

export interface ExpectedIncome {
  id: string;
  label: string;
  amount: number;
  expectedDate: IsoDate;
}

export type ObligationKind = "bill" | "card_bill" | "loan" | "owed_to_person";

/** Money already promised: subtracted before it's paid. */
export interface Obligation {
  id: string;
  kind: ObligationKind;
  label: string;
  dueDate: IsoDate;
  /** Card bills: the minimum payment by default (S3-6). */
  amount: number;
  /** Paid in earlier cycles (partial payments, D5). */
  paidBefore?: number;
  /** "≈": average of the last 3, or a card bill before its statement (S3-8). */
  estimated?: boolean;
  /** The card or loan account, so a plain transfer to it pays this. */
  accountId?: string;
}

export interface DisponibleInput {
  cycle: { start: IsoDate; end: IsoDate; days: number; daysLeft: number };
  today: IsoDate;
  accounts: DisponibleAccount[];
  expectedIncomes: ExpectedIncome[];
  movements: DisponibleMovement[];
  obligations: Obligation[];
  savingsTarget?: number;
  /** "Apartar" for a big bill ahead (S3-7): subtracted each cycle like Ahorro. */
  reservations?: { id: string; label: string; amount: number }[];
  /** Previous cycle's result carried in: negative = te pasaste, positive = te sobró and stayed (S3-3). */
  carryOver?: number;
  /** "Cuadrar con mi saldo". */
  balanceAdjustments?: { id: string; amount: number }[];
  /** First cycle: the balance of the counted accounts the user told us, and when. */
  anchor?: { at: string; balance: number };
  /** Irregular income: only received money counts, from this opening balance. */
  irregular?: boolean;
  openingBalance?: number;
  /** Capture sources that have gone quiet. */
  staleSources?: string[];
}

export interface DisponibleLine {
  id: string;
  label: string;
  amount: number;
  /** Salary not seen yet: the expected amount counts meanwhile. */
  pending?: boolean;
  estimated?: boolean;
  /** Partial payments (D5): "Pagado $paid de $total". */
  paid?: number;
  total?: number;
}

export interface DisponibleSection {
  total: number;
  lines: DisponibleLine[];
}

export type ApproxReason = "salary_pending" | "foreign_currency" | "source_quiet";

export interface DisponibleResult {
  disponible: number;
  perDay: number;
  daysLeft: number;
  /** The cycle before any spending, with today's knowledge (the verdict compares against it). */
  startingDisponible: number;
  startingPerDay: number;
  llega: DisponibleSection;
  porPagar: DisponibleSection;
  ahorro: DisponibleSection & { filledByTransfers: number };
  yaSalio: DisponibleSection;
  ajustes: DisponibleSection;
  /** Show "~" with the reasons; the number is never hidden. */
  approximate: boolean;
  reasons: ApproxReason[];
  /** Irregular income: the usual income not received yet, shown apart. */
  expectedApart: number;
}

/** Money is kept at cents (like numeric(15,2)), so sums never drift. */
const cents = (n: number) => Math.round(n * 100) / 100;
const sum = (xs: number[]) => cents(xs.reduce((a, b) => a + b, 0));
const floorTo100 = (n: number) => Math.floor(n / 100) * 100;
const section = (lines: DisponibleLine[]): DisponibleSection => ({ total: sum(lines.map((l) => l.amount)), lines });

/** D5: a bill is paid once its payments reach the amount within 5%. */
export const PAID_TOLERANCE_PERCENT = 95;

/** Which expected income each salary replaces: its own, else the first one still open. */
function matchSalaries(incomes: ExpectedIncome[], salaries: DisponibleMovement[]) {
  const received = new Map<string, number>();
  const claimed = new Set<string>();
  for (const e of incomes) {
    const linked = salaries.filter((m) => m.expectedIncomeId === e.id);
    if (linked.length === 0) {
      const loose = salaries.find((m) => !m.expectedIncomeId && !claimed.has(m.id));
      if (loose) linked.push(loose);
    }
    linked.forEach((m) => claimed.add(m.id));
    if (linked.length) received.set(e.id, sum(linked.map((m) => m.amount)));
  }
  return { received, claimed };
}

export function computeDisponible(input: DisponibleInput): DisponibleResult {
  const { cycle, anchor } = input;
  const debt = new Set(input.accounts.filter((a) => a.isDebt).map((a) => a.id));
  // Cards and loans never count, whatever the setting says (S3-0).
  const counts = new Map(input.accounts.map((a) => [a.id, a.countsInDisponible && !a.isDebt]));
  const anchorDate = anchor?.at.slice(0, 10);

  // Movements on counted accounts inside the cycle. In the first cycle, those
  // before the anchor are already in the balance the user told us.
  const inCycle = input.movements.filter(
    (m) => counts.get(m.accountId) && m.kind !== "ignored" && m.date >= cycle.start && m.date <= cycle.end,
  );
  const beforeAnchor = (m: DisponibleMovement) =>
    !!anchorDate && (m.date < anchorDate || (m.date === anchorDate && !(m.at && m.at > anchor!.at)));
  const movements = inCycle.filter((m) => !beforeAnchor(m));
  const priorMovements = inCycle.filter(beforeAnchor);

  // Transfers: nothing between counted accounts; to a card/loan it's a payment,
  // from one it's an advance; to an account we don't know it's just money out.
  const transferKind = (m: DisponibleMovement) => {
    const other = m.counterpartAccountId;
    if (!other || !counts.has(other)) return m.direction === "OUTFLOW" ? "unknown_out" : "unknown_in";
    if (counts.get(other)) return "internal";
    if (debt.has(other)) return m.direction === "OUTFLOW" ? "debt_payment" : "advance";
    return m.direction === "OUTFLOW" ? "out" : "in";
  };
  const isTransfer = (kind: string) => (m: DisponibleMovement) => m.kind === "transfer" && transferKind(m) === kind;
  const isPayment = (m: DisponibleMovement) => m.kind === "payment" || isTransfer("debt_payment")(m);

  // ── Llega este ciclo ──
  const llega: DisponibleLine[] = [];
  let salaryPending = false;
  let expectedApart = 0;
  if (anchor) llega.push({ id: "anchor", label: "Saldo inicial", amount: anchor.balance });
  if (input.irregular) llega.push({ id: "opening", label: "Saldo inicial", amount: input.openingBalance ?? 0 });

  let incomes = input.expectedIncomes
    .filter((e) => e.expectedDate >= cycle.start && e.expectedDate <= cycle.end)
    .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
  if (anchorDate) {
    // A salary that arrived before the anchor is inside the balance: drop its expected income.
    const prior = matchSalaries(incomes, priorMovements.filter((m) => m.kind === "salary"));
    incomes = incomes.filter((e) => e.expectedDate >= anchorDate && !prior.received.has(e.id));
  }
  const salaries = movements.filter((m) => m.kind === "salary");
  const { received, claimed } = matchSalaries(incomes, salaries);
  for (const e of incomes) {
    const got = received.get(e.id) ?? 0;
    if (input.irregular) {
      if (got > 0) llega.push({ id: e.id, label: e.label, amount: got, pending: false });
      expectedApart = cents(expectedApart + Math.max(0, e.amount - got));
      continue;
    }
    // Unconfirmed only once its date has passed; income due later in the cycle is just expected.
    if (got === 0 && e.expectedDate <= input.today) salaryPending = true;
    llega.push({ id: e.id, label: e.label, amount: got || e.amount, pending: got === 0 });
  }

  const pushSum = (id: string, label: string, ms: DisponibleMovement[]) => {
    const amount = sum(ms.map((m) => m.amount));
    if (amount !== 0) llega.push({ id, label, amount });
  };
  pushSum("income", "Otros ingresos", [
    ...movements.filter((m) => m.kind === "income" || (m.kind === "salary" && !claimed.has(m.id))),
    ...movements.filter(isTransfer("unknown_in")),
  ]);
  pushSum("repayment", "Te pagaron", movements.filter((m) => m.kind === "repayment"));
  pushSum("from_savings", "Traje de mis ahorros", movements.filter(isTransfer("in")));
  pushSum("advance", "Avance de tarjeta o crédito", movements.filter(isTransfer("advance")));

  // ── Por pagar ──
  const open = input.obligations
    .filter((o) => o.dueDate <= cycle.end)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id))
    .map((o) => ({ o, paid: o.paidBefore ?? 0, before: o.paidBefore ?? 0 }));
  const allocate = (p: DisponibleMovement, prior: boolean) => {
    const apply = (x: (typeof open)[number], amount: number) => {
      x.paid = cents(x.paid + amount);
      if (prior) x.before = cents(x.before + amount);
    };
    if (p.obligationId) {
      const x = open.find((y) => y.o.id === p.obligationId);
      if (x) apply(x, p.amount); // beyond the bill it's an extra payment
      return;
    }
    // A plain transfer to a card/loan pays its open bills in due order; the rest is extra.
    let left = p.amount;
    for (const x of open) {
      if (left <= 0 || !p.counterpartAccountId || x.o.accountId !== p.counterpartAccountId) continue;
      const take = Math.min(left, Math.max(0, x.o.amount - x.paid));
      apply(x, take);
      left = cents(left - take);
    }
  };
  priorMovements.filter(isPayment).forEach((p) => allocate(p, true));
  const payments = movements.filter(isPayment);
  payments.forEach((p) => allocate(p, false));

  const settled = (o: Obligation, paid: number) =>
    paid * 100 >= PAID_TOLERANCE_PERCENT * o.amount || (!!o.estimated && paid > 0);
  const porPagar: DisponibleLine[] = [];
  for (const { o, paid } of open) {
    if (settled(o, paid)) continue;
    porPagar.push({
      id: o.id, label: o.label, amount: cents(o.amount - paid),
      ...(o.estimated ? { estimated: true } : {}),
      ...(paid > 0 ? { paid, total: o.amount } : {}),
    });
  }

  // ── Ahorro ──
  const ahorroLines: DisponibleLine[] = [];
  if (input.savingsTarget) ahorroLines.push({ id: "savings", label: "Ahorro", amount: input.savingsTarget });
  for (const r of input.reservations ?? []) ahorroLines.push({ id: r.id, label: `Apartado: ${r.label}`, amount: r.amount });
  const ahorroTotal = sum(ahorroLines.map((l) => l.amount));
  // Money moved to an own account that doesn't count fills Ahorro first; only the excess is Ya salió.
  const movedOut = sum(movements.filter(isTransfer("out")).map((m) => m.amount));
  const filledByTransfers = Math.min(movedOut, ahorroTotal);

  // ── Ya salió ──
  const yaSalio: DisponibleLine[] = [];
  const out = (id: string, label: string, amount: number) => amount !== 0 && yaSalio.push({ id, label, amount });
  out("spend", "Gastos", sum([...movements.filter((m) => m.kind === "spend"), ...movements.filter(isTransfer("unknown_out"))].map((m) => m.amount)));
  out("payments", "Pagos", sum(payments.map((m) => m.amount)));
  out("moved_out", "A cuentas aparte", cents(movedOut - filledByTransfers));
  out("refunds", "Devoluciones", -sum(movements.filter((m) => m.kind === "refund").map((m) => m.amount)));

  // ── Ajustes ──
  const ajustes: DisponibleLine[] = [];
  if (input.carryOver) {
    ajustes.push({
      id: "carry",
      label: input.carryOver < 0 ? "Te pasaste el ciclo pasado" : "Te sobró el ciclo pasado",
      amount: input.carryOver,
    });
  }
  for (const a of input.balanceAdjustments ?? []) ajustes.push({ id: a.id, label: "Ajuste de saldo", amount: a.amount });

  const L = section(llega);
  const P = section(porPagar);
  const S = section(ahorroLines);
  const Y = section(yaSalio);
  const A = section(ajustes);
  const disponible = cents(L.total - P.total - S.total - Y.total + A.total);
  // What was promised when the cycle began: each bill minus what was paid before this cycle's movements.
  const promised = sum(open.map(({ o, before }) => (settled(o, before) ? 0 : Math.max(0, o.amount - before))));
  const startingDisponible = cents(L.total - promised - S.total + A.total);

  const reasons: ApproxReason[] = [];
  if (salaryPending) reasons.push("salary_pending");
  if (movements.some((m) => m.approx)) reasons.push("foreign_currency");
  if (input.staleSources?.length) reasons.push("source_quiet");

  return {
    disponible,
    perDay: disponible > 0 ? floorTo100(disponible / Math.max(1, cycle.daysLeft)) : 0,
    daysLeft: cycle.daysLeft,
    startingDisponible,
    startingPerDay: startingDisponible > 0 ? floorTo100(startingDisponible / Math.max(1, cycle.days)) : 0,
    llega: L,
    porPagar: P,
    ahorro: { ...S, filledByTransfers },
    yaSalio: Y,
    ajustes: A,
    approximate: reasons.length > 0,
    reasons,
    expectedApart,
  };
}
