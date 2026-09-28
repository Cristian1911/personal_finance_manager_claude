import {
  classifyFlow,
  FLOW_CLASS_RULES_VERSION,
  CATEGORY_HOGAR,
  CATEGORY_COMER_FUERA,
  CATEGORY_TRANSPORTE,
  CATEGORY_SALUD,
  CATEGORY_ESTILO_DE_VIDA,
  CATEGORY_OBLIGACIONES,
  CATEGORY_INGRESOS,
  CATEGORY_OTROS_INGRESOS,
  SUB_ARRIENDO,
  SUB_MERCADO,
  SUB_SERVICIOS_PUBLICOS,
  SUB_INTERNET,
  SUB_RESTAURANTES,
  SUB_DOMICILIOS,
  SUB_CAFE_SNACKS,
  SUB_TRANSPORTE_PUBLICO,
  SUB_GASOLINA,
  SUB_MEDICAMENTOS,
  SUB_ROPA,
  SUB_GYM_DEPORTE,
  SUB_CUOTA_CREDITO,
  SUB_PAGO_TARJETA,
  SUB_SALARIO,
} from "@zeta/shared";
import * as Crypto from "expo-crypto";
import { clearDatabase, getDatabase } from "./db/database";
import { DEMO_USER_ID } from "./demo-mode";
import { toColombiaDateString } from "./utils/date";

/**
 * Demo seed — "Probar demo sin cuenta" on the login screen.
 *
 * Everything here is owned by `DEMO_USER_ID` and lives only in SQLite: demo
 * mode never syncs (see `lib/demo-mode.ts` for the three guards). Leaving
 * demo runs `clearDatabase()`, which wipes all of it.
 *
 * Dates are relative to today's Colombian wall-clock date, so the demo always
 * shows the current month and the previous one. No row is dated in the
 * future except the pending recurring occurrence.
 */

type CategorySeed = {
  id: string;
  name: string;
  name_es: string;
  slug: string;
  icon: string;
  color: string;
  direction: "INFLOW" | "OUTFLOW";
  parent_id: string | null;
  expense_type: "fixed" | "variable" | null;
  display_order: number;
};

// Names, icons and colors mirror the Supabase system seed so the demo renders
// exactly like a real account. Transactions and budgets always point at a
// subcategory (a leaf); parents are only for grouping.
const DEMO_CATEGORIES: CategorySeed[] = [
  // Parents first (FK: subcategories reference them).
  { id: CATEGORY_HOGAR, name: "Home", name_es: "Hogar", slug: "hogar", icon: "home", color: "#6366f1", direction: "OUTFLOW", parent_id: null, expense_type: null, display_order: 1 },
  { id: CATEGORY_COMER_FUERA, name: "Eating Out", name_es: "Comer fuera", slug: "comer-fuera", icon: "utensils", color: "#10b981", direction: "OUTFLOW", parent_id: null, expense_type: null, display_order: 2 },
  { id: CATEGORY_TRANSPORTE, name: "Transport", name_es: "Transporte", slug: "transporte", icon: "car", color: "#f59e0b", direction: "OUTFLOW", parent_id: null, expense_type: null, display_order: 3 },
  { id: CATEGORY_SALUD, name: "Health", name_es: "Salud", slug: "salud", icon: "heart-pulse", color: "#ef4444", direction: "OUTFLOW", parent_id: null, expense_type: null, display_order: 4 },
  { id: CATEGORY_ESTILO_DE_VIDA, name: "Lifestyle", name_es: "Estilo de vida", slug: "estilo-de-vida", icon: "sparkles", color: "#ec4899", direction: "OUTFLOW", parent_id: null, expense_type: null, display_order: 5 },
  { id: CATEGORY_OBLIGACIONES, name: "Obligations", name_es: "Obligaciones", slug: "obligaciones", icon: "shield", color: "#64748b", direction: "OUTFLOW", parent_id: null, expense_type: null, display_order: 6 },
  { id: CATEGORY_INGRESOS, name: "Income", name_es: "Ingresos", slug: "ingresos", icon: "briefcase", color: "#22c55e", direction: "INFLOW", parent_id: null, expense_type: null, display_order: 7 },
  { id: CATEGORY_OTROS_INGRESOS, name: "Other Income", name_es: "Otros ingresos", slug: "otros-ingresos", icon: "plus-circle", color: "#64748b", direction: "INFLOW", parent_id: null, expense_type: null, display_order: 8 },

  { id: SUB_ARRIENDO, name: "Rent/Mortgage", name_es: "Arriendo/Hipoteca", slug: "arriendo-hipoteca", icon: "house", color: "#6366f1", direction: "OUTFLOW", parent_id: CATEGORY_HOGAR, expense_type: "fixed", display_order: 1 },
  { id: SUB_MERCADO, name: "Groceries", name_es: "Mercado", slug: "mercado", icon: "shopping-cart", color: "#6366f1", direction: "OUTFLOW", parent_id: CATEGORY_HOGAR, expense_type: "fixed", display_order: 3 },
  { id: SUB_SERVICIOS_PUBLICOS, name: "Utilities", name_es: "Servicios públicos", slug: "servicios-publicos", icon: "zap", color: "#6366f1", direction: "OUTFLOW", parent_id: CATEGORY_HOGAR, expense_type: "fixed", display_order: 4 },
  { id: SUB_INTERNET, name: "Internet", name_es: "Internet", slug: "internet", icon: "wifi", color: "#6366f1", direction: "OUTFLOW", parent_id: CATEGORY_HOGAR, expense_type: "fixed", display_order: 5 },
  { id: SUB_RESTAURANTES, name: "Restaurants", name_es: "Restaurantes", slug: "restaurantes", icon: "utensils", color: "#10b981", direction: "OUTFLOW", parent_id: CATEGORY_COMER_FUERA, expense_type: "variable", display_order: 1 },
  { id: SUB_DOMICILIOS, name: "Delivery", name_es: "Domicilios", slug: "domicilios", icon: "bike", color: "#10b981", direction: "OUTFLOW", parent_id: CATEGORY_COMER_FUERA, expense_type: "variable", display_order: 2 },
  { id: SUB_CAFE_SNACKS, name: "Coffee/Snacks", name_es: "Café/Snacks", slug: "cafe-snacks", icon: "coffee", color: "#10b981", direction: "OUTFLOW", parent_id: CATEGORY_COMER_FUERA, expense_type: "variable", display_order: 3 },
  { id: SUB_TRANSPORTE_PUBLICO, name: "Public Transit", name_es: "Transporte público", slug: "transporte-publico", icon: "bus", color: "#f59e0b", direction: "OUTFLOW", parent_id: CATEGORY_TRANSPORTE, expense_type: "fixed", display_order: 1 },
  { id: SUB_GASOLINA, name: "Gas", name_es: "Gasolina", slug: "gasolina", icon: "fuel", color: "#f59e0b", direction: "OUTFLOW", parent_id: CATEGORY_TRANSPORTE, expense_type: "variable", display_order: 2 },
  { id: SUB_MEDICAMENTOS, name: "Medications", name_es: "Medicamentos", slug: "medicamentos", icon: "pill", color: "#ef4444", direction: "OUTFLOW", parent_id: CATEGORY_SALUD, expense_type: "variable", display_order: 4 },
  { id: SUB_ROPA, name: "Clothing", name_es: "Ropa", slug: "ropa", icon: "shirt", color: "#ec4899", direction: "OUTFLOW", parent_id: CATEGORY_ESTILO_DE_VIDA, expense_type: "variable", display_order: 1 },
  { id: SUB_GYM_DEPORTE, name: "Gym/Sports", name_es: "Gym/Deporte", slug: "gym-deporte", icon: "dumbbell", color: "#ec4899", direction: "OUTFLOW", parent_id: CATEGORY_ESTILO_DE_VIDA, expense_type: "variable", display_order: 3 },
  { id: SUB_CUOTA_CREDITO, name: "Loan Payment", name_es: "Cuota crédito", slug: "cuota-credito", icon: "banknote", color: "#64748b", direction: "OUTFLOW", parent_id: CATEGORY_OBLIGACIONES, expense_type: "fixed", display_order: 1 },
  { id: SUB_PAGO_TARJETA, name: "Credit Card", name_es: "Tarjeta de crédito", slug: "tarjeta-credito", icon: "credit-card", color: "#64748b", direction: "OUTFLOW", parent_id: CATEGORY_OBLIGACIONES, expense_type: "fixed", display_order: 2 },
  { id: SUB_SALARIO, name: "Salary", name_es: "Salario", slug: "salario", icon: "briefcase", color: "#22c55e", direction: "INFLOW", parent_id: CATEGORY_INGRESOS, expense_type: null, display_order: 1 },
];

/* ─── Dates (Colombian wall clock, string math only) ─────────────────────── */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month = last day of `month` (1-12). UTC keeps it
  // independent of the device zone.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function buildCalendar() {
  const today = toColombiaDateString();
  const [ty, tm, td] = today.split("-").map(Number);
  const prevY = tm === 1 ? ty - 1 : ty;
  const prevM = tm === 1 ? 12 : tm - 1;
  const curDays = daysInMonth(ty, tm);
  const prevDays = daysInMonth(prevY, prevM);
  return {
    today,
    todayDay: td,
    /** Day of the current month, clamped to today (never in the future). */
    cur: (day: number) => `${ty}-${pad(tm)}-${pad(Math.min(day, td))}`,
    /** Day of the current month, or null when it is still in the future. */
    curIfPast: (day: number) => (day <= td ? `${ty}-${pad(tm)}-${pad(day)}` : null),
    /** Day of the current month without clamping (scheduled items). */
    curScheduled: (day: number) => `${ty}-${pad(tm)}-${pad(Math.min(day, curDays))}`,
    /** Day of the previous month, clamped to that month's length. */
    prev: (day: number) => `${prevY}-${pad(prevM)}-${pad(Math.min(day, prevDays))}`,
  };
}

/* ─── Seed ───────────────────────────────────────────────────────────────── */

type AccountKind = "SAVINGS" | "CREDIT_CARD" | "LOAN";

type TxSeed = {
  account: AccountKind;
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  description: string;
  merchant?: string | null;
  date: string | null;
  categoryId: string;
  destinatario?: DestinatarioKey | null;
  /** Stable handle so recurring occurrences can point at this row. */
  ref?: string;
};

type DestinatarioKey = "exito" | "rappi" | "arriendo";

export async function seedDemoData(): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const cal = buildCalendar();

  await clearDatabase();

  // One transaction: a failure halfway never leaves the demo profile (which
  // arms the sync_queue trigger) without the rest of its data.
  await db.withTransactionAsync(async () => {
    // The profile row goes first: its presence is what arms the sync_queue
    // trigger (lib/db/database.ts) for the rest of the demo session.
    await db.runAsync(
      `INSERT INTO profiles
        (id, email, full_name, app_purpose, estimated_monthly_income, estimated_monthly_expenses, preferred_currency, timezone, locale, onboarding_completed, plan, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'free', ?, ?)`,
      [
        DEMO_USER_ID,
        "demo@zeta.local",
        "Demo Zeta",
        "manage_debt",
        4200000,
        3600000,
        "COP",
        "America/Bogota",
        "es-CO",
        now,
        now,
      ]
    );

    /* Accounts */
    const accountIds: Record<AccountKind, string> = {
      SAVINGS: Crypto.randomUUID(),
      CREDIT_CARD: Crypto.randomUUID(),
      LOAN: Crypto.randomUUID(),
    };

    const accounts = [
      {
        id: accountIds.SAVINGS,
        name: "Cuenta de ahorros",
        type: "SAVINGS",
        balance: 3185400,
        available: null,
        limit: null,
        rate: null,
        icon: "wallet",
        color: "#10B981",
        monthlyPayment: null,
        paymentDay: null,
        cutoffDay: null,
      },
      {
        id: accountIds.CREDIT_CARD,
        name: "Tarjeta de crédito",
        type: "CREDIT_CARD",
        balance: 1284600,
        available: 3715400,
        limit: 5000000,
        rate: 28.9,
        icon: "credit-card",
        color: "#6366F1",
        monthlyPayment: null,
        paymentDay: 15,
        cutoffDay: 30,
      },
      {
        id: accountIds.LOAN,
        name: "Crédito de vehículo",
        type: "LOAN",
        balance: 18650000,
        available: null,
        limit: null,
        rate: 16.4,
        icon: "landmark",
        color: "#F97316",
        monthlyPayment: 510000,
        paymentDay: 18,
        cutoffDay: null,
      },
    ];

    for (const a of accounts) {
      await db.runAsync(
        `INSERT INTO accounts
          (id, user_id, name, account_type, institution_name, currency_code, current_balance, available_balance, credit_limit, interest_rate, is_active, icon, color, monthly_payment, payment_day, cutoff_day, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'COP', ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
        [
          a.id,
          DEMO_USER_ID,
          a.name,
          a.type,
          "Banco Demo",
          a.balance,
          a.available,
          a.limit,
          a.rate,
          a.icon,
          a.color,
          a.monthlyPayment,
          a.paymentDay,
          a.cutoffDay,
          now,
          now,
        ]
      );
    }

    /* Categories (system rows: user_id NULL, like the Supabase seed) */
    for (const c of DEMO_CATEGORIES) {
      await db.runAsync(
        `INSERT INTO categories
          (id, user_id, name, name_es, slug, icon, color, direction, expense_type, parent_id, is_system, display_order, created_at)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [
          c.id,
          c.name,
          c.name_es,
          c.slug,
          c.icon,
          c.color,
          c.direction,
          c.expense_type,
          c.parent_id,
          c.display_order,
          now,
        ]
      );
    }

    /* Destinatarios + matching rules */
    const destinatarios: Record<
      DestinatarioKey,
      { id: string; name: string; categoryId: string; pattern: string }
    > = {
      exito: { id: Crypto.randomUUID(), name: "Supermercado Éxito", categoryId: SUB_MERCADO, pattern: "EXITO" },
      rappi: { id: Crypto.randomUUID(), name: "Rappi", categoryId: SUB_DOMICILIOS, pattern: "RAPPI" },
      arriendo: { id: Crypto.randomUUID(), name: "Arrendamientos Laureles", categoryId: SUB_ARRIENDO, pattern: "ARRENDAMIENTOS LAURELES" },
    };

    /* Transactions — previous month + current month */
    const txs: TxSeed[] = [
      // ── Previous month ──
      { account: "SAVINGS", amount: 1450000, direction: "OUTFLOW", description: "Arriendo apartamento", merchant: "Arrendamientos Laureles", date: cal.prev(1), categoryId: SUB_ARRIENDO, destinatario: "arriendo", ref: "rent-prev" },
      { account: "SAVINGS", amount: 312400, direction: "OUTFLOW", description: "Mercado del mes", merchant: "Éxito", date: cal.prev(3), categoryId: SUB_MERCADO, destinatario: "exito" },
      { account: "SAVINGS", amount: 238700, direction: "OUTFLOW", description: "Servicios públicos", merchant: "EPM", date: cal.prev(5), categoryId: SUB_SERVICIOS_PUBLICOS },
      { account: "CREDIT_CARD", amount: 46500, direction: "OUTFLOW", description: "Domicilio almuerzo", merchant: "Rappi", date: cal.prev(8), categoryId: SUB_DOMICILIOS, destinatario: "rappi" },
      { account: "CREDIT_CARD", amount: 150000, direction: "OUTFLOW", description: "Tanqueada", merchant: "Estación de servicio", date: cal.prev(10), categoryId: SUB_GASOLINA },
      { account: "CREDIT_CARD", amount: 32000, direction: "OUTFLOW", description: "Almuerzo ejecutivo", merchant: "Restaurante El Corrientazo", date: cal.prev(12), categoryId: SUB_RESTAURANTES },
      { account: "SAVINGS", amount: 2100000, direction: "INFLOW", description: "Nómina primera quincena", merchant: null, date: cal.prev(15), categoryId: SUB_SALARIO },
      { account: "SAVINGS", amount: 268900, direction: "OUTFLOW", description: "Mercado quincenal", merchant: "Éxito", date: cal.prev(17), categoryId: SUB_MERCADO, destinatario: "exito" },
      { account: "CREDIT_CARD", amount: 38900, direction: "OUTFLOW", description: "Domicilio cena", merchant: "Rappi", date: cal.prev(21), categoryId: SUB_DOMICILIOS, destinatario: "rappi" },
      { account: "SAVINGS", amount: 54300, direction: "OUTFLOW", description: "Droguería", merchant: "Droguería La Rebaja", date: cal.prev(24), categoryId: SUB_MEDICAMENTOS },
      { account: "CREDIT_CARD", amount: 12500, direction: "OUTFLOW", description: "Café", merchant: "Café de la esquina", date: cal.prev(26), categoryId: SUB_CAFE_SNACKS },
      { account: "SAVINGS", amount: 89900, direction: "OUTFLOW", description: "Internet hogar", merchant: "Internet hogar", date: cal.prev(28), categoryId: SUB_INTERNET, ref: "internet-prev" },
      { account: "SAVINGS", amount: 2100000, direction: "INFLOW", description: "Nómina segunda quincena", merchant: null, date: cal.prev(30), categoryId: SUB_SALARIO },
      // ── Current month ──
      { account: "SAVINGS", amount: 1450000, direction: "OUTFLOW", description: "Arriendo apartamento", merchant: "Arrendamientos Laureles", date: cal.cur(1), categoryId: SUB_ARRIENDO, destinatario: "arriendo", ref: "rent-cur" },
      { account: "SAVINGS", amount: 295600, direction: "OUTFLOW", description: "Mercado del mes", merchant: "Éxito", date: cal.cur(2), categoryId: SUB_MERCADO, destinatario: "exito" },
      { account: "SAVINGS", amount: 50000, direction: "OUTFLOW", description: "Recarga tarjeta de transporte", merchant: null, date: cal.cur(3), categoryId: SUB_TRANSPORTE_PUBLICO },
      { account: "CREDIT_CARD", amount: 52900, direction: "OUTFLOW", description: "Domicilio almuerzo", merchant: "Rappi", date: cal.cur(4), categoryId: SUB_DOMICILIOS, destinatario: "rappi" },
      { account: "SAVINGS", amount: 241300, direction: "OUTFLOW", description: "Servicios públicos", merchant: "EPM", date: cal.cur(5), categoryId: SUB_SERVICIOS_PUBLICOS },
      { account: "CREDIT_CARD", amount: 68000, direction: "OUTFLOW", description: "Cena con amigos", merchant: "Restaurante Andrés", date: cal.cur(6), categoryId: SUB_RESTAURANTES },
      { account: "CREDIT_CARD", amount: 140000, direction: "OUTFLOW", description: "Tanqueada", merchant: "Estación de servicio", date: cal.cur(7), categoryId: SUB_GASOLINA },
      { account: "CREDIT_CARD", amount: 95000, direction: "OUTFLOW", description: "Mensualidad gimnasio", merchant: "Gimnasio", date: cal.cur(8), categoryId: SUB_GYM_DEPORTE },
      { account: "SAVINGS", amount: 184300, direction: "OUTFLOW", description: "Mercado quincenal", merchant: "Éxito", date: cal.cur(9), categoryId: SUB_MERCADO, destinatario: "exito" },
      { account: "CREDIT_CARD", amount: 129900, direction: "OUTFLOW", description: "Ropa", merchant: "Tienda de ropa", date: cal.cur(10), categoryId: SUB_ROPA },
      { account: "CREDIT_CARD", amount: 41200, direction: "OUTFLOW", description: "Domicilio cena", merchant: "Rappi", date: cal.cur(11), categoryId: SUB_DOMICILIOS, destinatario: "rappi" },
      { account: "CREDIT_CARD", amount: 9800, direction: "OUTFLOW", description: "Café", merchant: "Café de la esquina", date: cal.cur(13), categoryId: SUB_CAFE_SNACKS },
      { account: "SAVINGS", amount: 2100000, direction: "INFLOW", description: "Nómina primera quincena", merchant: null, date: cal.curIfPast(15), categoryId: SUB_SALARIO },
    ];

    /* Debt payments — two linked legs each (source OUTFLOW + debt INFLOW) */
    const transfers: Array<{
      to: "CREDIT_CARD" | "LOAN";
      amount: number;
      description: string;
      date: string;
      categoryId: string;
    }> = [
      { to: "CREDIT_CARD", amount: 850000, description: "Pago tarjeta de crédito", date: cal.prev(16), categoryId: SUB_PAGO_TARJETA },
      { to: "LOAN", amount: 510000, description: "Cuota crédito de vehículo", date: cal.prev(18), categoryId: SUB_CUOTA_CREDITO },
      { to: "CREDIT_CARD", amount: 700000, description: "Pago tarjeta de crédito", date: cal.cur(12), categoryId: SUB_PAGO_TARJETA },
      { to: "LOAN", amount: 510000, description: "Cuota crédito de vehículo", date: cal.cur(18), categoryId: SUB_CUOTA_CREDITO },
    ];

    const txIdsByRef: Record<string, string> = {};
    const destinatarioMatches: Record<DestinatarioKey, { count: number; last: string | null }> = {
      exito: { count: 0, last: null },
      rappi: { count: 0, last: null },
      arriendo: { count: 0, last: null },
    };

    async function insertTx(
      row: {
        account: AccountKind;
        amount: number;
        direction: "INFLOW" | "OUTFLOW";
        description: string;
        merchant: string | null;
        date: string;
        categoryId: string;
        destinatarioId: string | null;
        transferGroupId: string | null;
        counterpartAccountType: string | null;
      }
    ): Promise<string> {
      const id = Crypto.randomUUID();
      await db.runAsync(
        `INSERT INTO transactions
          (id, user_id, account_id, category_id, amount, direction, description, merchant_name, raw_description, transaction_date, status, idempotency_key, is_excluded, notes,
           destinatario_id, transfer_group_id, flow_class, flow_class_version, source_pattern, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 'POSTED', ?, 0, NULL, ?, ?, ?, ?, NULL, ?, ?)`,
        [
          id,
          DEMO_USER_ID,
          accountIds[row.account],
          row.categoryId,
          row.amount,
          row.direction,
          row.description,
          row.merchant,
          row.date,
          Crypto.randomUUID(),
          row.destinatarioId,
          row.transferGroupId,
          // Seeded fixtures classify like real data, so the demo does not show
          // inflated totals (debt payments are not spending, etc.).
          classifyFlow({
            direction: row.direction,
            accountType: row.account,
            description: row.description,
            transferGroupId: row.transferGroupId,
            counterpartAccountType: row.counterpartAccountType,
          }).flowClass,
          FLOW_CLASS_RULES_VERSION,
          now,
          now,
        ]
      );
      return id;
    }

    // Destinatarios before transactions (FK-free column, but keep parents first).
    for (const d of Object.values(destinatarios)) {
      await db.runAsync(
        `INSERT INTO destinatarios
          (id, user_id, name, name_hmac, default_category_id, notes, is_active, kind, is_ad_hoc, created_at, updated_at)
         VALUES (?, ?, ?, NULL, ?, NULL, 1, 'merchant', 0, ?, ?)`,
        [d.id, DEMO_USER_ID, d.name, d.categoryId, now, now]
      );
    }

    for (const tx of txs) {
      if (!tx.date) continue; // e.g. a quincena that has not arrived yet
      const destKey = tx.destinatario ?? null;
      const id = await insertTx({
        account: tx.account,
        amount: tx.amount,
        direction: tx.direction,
        description: tx.description,
        merchant: tx.merchant ?? null,
        date: tx.date,
        categoryId: tx.categoryId,
        destinatarioId: destKey ? destinatarios[destKey].id : null,
        transferGroupId: null,
        counterpartAccountType: null,
      });
      if (tx.ref) txIdsByRef[tx.ref] = id;
      if (destKey) {
        const m = destinatarioMatches[destKey];
        m.count += 1;
        if (!m.last || tx.date > m.last) m.last = tx.date;
      }
    }

    for (const t of transfers) {
      const groupId = Crypto.randomUUID();
      await insertTx({
        account: "SAVINGS",
        amount: t.amount,
        direction: "OUTFLOW",
        description: t.description,
        merchant: null,
        date: t.date,
        categoryId: t.categoryId,
        destinatarioId: null,
        transferGroupId: groupId,
        counterpartAccountType: t.to,
      });
      await insertTx({
        account: t.to,
        amount: t.amount,
        direction: "INFLOW",
        description: t.description,
        merchant: null,
        date: t.date,
        categoryId: t.categoryId,
        destinatarioId: null,
        transferGroupId: groupId,
        counterpartAccountType: "SAVINGS",
      });
    }

    for (const [key, d] of Object.entries(destinatarios) as Array<
      [DestinatarioKey, (typeof destinatarios)[DestinatarioKey]]
    >) {
      const m = destinatarioMatches[key];
      await db.runAsync(
        `INSERT INTO destinatario_rules
          (id, user_id, destinatario_id, pattern, match_type, priority, match_count, last_matched_at, created_at)
         VALUES (?, ?, ?, ?, 'contains', 0, ?, ?, ?)`,
        [
          Crypto.randomUUID(),
          DEMO_USER_ID,
          d.id,
          d.pattern,
          m.count,
          m.last ? `${m.last}T12:00:00.000Z` : null,
          now,
        ]
      );
    }

    /* Recurring templates + this month's occurrences (one paid, one pending) */
    const rentTemplateId = Crypto.randomUUID();
    const internetTemplateId = Crypto.randomUUID();
    const INTERNET_DAY = 28;

    const templates = [
      {
        id: rentTemplateId,
        amount: 1450000,
        day: 1,
        startDate: cal.prev(1),
        merchant: "Arrendamientos Laureles",
        description: "Arriendo apartamento",
        categoryId: SUB_ARRIENDO,
        destinatarioId: destinatarios.arriendo.id,
      },
      {
        id: internetTemplateId,
        amount: 89900,
        day: INTERNET_DAY,
        startDate: cal.prev(INTERNET_DAY),
        merchant: "Internet hogar",
        description: "Internet y TV",
        categoryId: SUB_INTERNET,
        destinatarioId: null,
      },
    ];

    for (const t of templates) {
      await db.runAsync(
        `INSERT INTO recurring_transaction_templates
          (id, user_id, account_id, category_id, amount, currency_code, direction, frequency,
           day_of_month, day_of_week, start_date, end_date, merchant_name, description,
           destinatario_id, transfer_source_account_id, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'COP', 'OUTFLOW', 'MONTHLY', ?, NULL, ?, NULL, ?, ?, ?, NULL, 1, ?, ?)`,
        [
          t.id,
          DEMO_USER_ID,
          accountIds.SAVINGS,
          t.categoryId,
          t.amount,
          t.day,
          t.startDate,
          t.merchant,
          t.description,
          t.destinatarioId,
          now,
          now,
        ]
      );
    }

    // Pending internet bill: day 28, or today when the month is already past it.
    const internetDueDay = Math.max(cal.todayDay, INTERNET_DAY);
    const occurrences = [
      { templateId: rentTemplateId, date: cal.prev(1), amount: 1450000, status: "paid", txRef: "rent-prev" },
      { templateId: internetTemplateId, date: cal.prev(INTERNET_DAY), amount: 89900, status: "paid", txRef: "internet-prev" },
      { templateId: rentTemplateId, date: cal.curScheduled(1), amount: 1450000, status: "paid", txRef: "rent-cur" },
      { templateId: internetTemplateId, date: cal.curScheduled(internetDueDay), amount: 89900, status: "pending", txRef: null },
    ];

    for (const o of occurrences) {
      const txId = o.txRef ? (txIdsByRef[o.txRef] ?? null) : null;
      const paid = o.status === "paid" && txId != null;
      await db.runAsync(
        `INSERT INTO recurring_occurrences
          (id, user_id, template_id, occurrence_date, expected_amount, status, transaction_id, paid_at, skipped_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        [
          Crypto.randomUUID(),
          DEMO_USER_ID,
          o.templateId,
          o.date,
          o.amount,
          paid ? "paid" : "pending",
          paid ? txId : null,
          paid ? `${o.date}T12:00:00.000Z` : null,
          now,
        ]
      );
    }

    /* Monthly budget — four lines on leaf categories */
    const budgetLines = [
      { categoryId: SUB_MERCADO, amount: 900000 },
      { categoryId: SUB_DOMICILIOS, amount: 150000 },
      { categoryId: SUB_RESTAURANTES, amount: 200000 },
      { categoryId: SUB_GASOLINA, amount: 300000 },
    ];
    for (const b of budgetLines) {
      await db.runAsync(
        `INSERT INTO budgets (id, user_id, category_id, amount, period, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'monthly', ?, ?)`,
        [Crypto.randomUUID(), DEMO_USER_ID, b.categoryId, b.amount, now, now]
      );
    }

    // Nothing above enqueues, but never leave an outbox or pull cursors behind.
    await db.runAsync("DELETE FROM sync_queue");
    await db.runAsync("DELETE FROM sync_metadata");
  });
}
