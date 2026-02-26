import * as Crypto from "expo-crypto";
import { clearDatabase, getDatabase } from "./db/database";

const DEMO_USER_ID = "00000000-0000-4000-8000-000000000000";

const DEMO_CATEGORIES = [
  {
    id: "a0000001-0001-4000-8000-000000000013",
    name: "Salary",
    name_es: "Salario",
    color: "#16A34A",
    icon: "SA",
    is_system: 1,
    display_order: 1,
  },
  {
    id: "a0000001-0001-4000-8000-000000000002",
    name: "Food",
    name_es: "Alimentacion",
    color: "#F59E0B",
    icon: "AL",
    is_system: 1,
    display_order: 2,
  },
  {
    id: "a0000001-0001-4000-8000-000000000004",
    name: "Services",
    name_es: "Servicios",
    color: "#3B82F6",
    icon: "SE",
    is_system: 1,
    display_order: 3,
  },
  {
    id: "a0000001-0001-4000-8000-000000000019",
    name: "Debt Payments",
    name_es: "Abonos a deuda",
    color: "#0EA5E9",
    icon: "AB",
    is_system: 1,
    display_order: 4,
  },
] as const;

function dateShift(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function seedDemoData(): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await clearDatabase();

  await db.runAsync(
    `INSERT INTO profiles
      (id, email, full_name, app_purpose, estimated_monthly_income, estimated_monthly_expenses, preferred_currency, timezone, locale, onboarding_completed, plan, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'free', ?, ?)`,
    [
      DEMO_USER_ID,
      "demo@venti5.local",
      "Demo Venti5",
      "manage_debt",
      6500000,
      4100000,
      "COP",
      "America/Bogota",
      "es-CO",
      now,
      now,
    ]
  );

  const checkingId = Crypto.randomUUID();
  const creditCardId = Crypto.randomUUID();
  const loanId = Crypto.randomUUID();

  await db.runAsync(
    `INSERT INTO accounts
      (id, user_id, name, account_type, institution_name, currency_code, current_balance, available_balance, credit_limit, interest_rate, is_active, icon, color, payment_day, cutoff_day, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'COP', ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
    [
      checkingId,
      DEMO_USER_ID,
      "Cuenta Principal Demo",
      "CHECKING",
      "Banco Demo",
      2850000,
      null,
      null,
      null,
      "wallet",
      "#10B981",
      null,
      null,
      now,
      now,
    ]
  );

  await db.runAsync(
    `INSERT INTO accounts
      (id, user_id, name, account_type, institution_name, currency_code, current_balance, available_balance, credit_limit, interest_rate, is_active, icon, color, payment_day, cutoff_day, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'COP', ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
    [
      creditCardId,
      DEMO_USER_ID,
      "TC Demo",
      "CREDIT_CARD",
      "Banco Demo",
      920000,
      1580000,
      2500000,
      31.2,
      "credit-card",
      "#6366F1",
      15,
      5,
      now,
      now,
    ]
  );

  await db.runAsync(
    `INSERT INTO accounts
      (id, user_id, name, account_type, institution_name, currency_code, current_balance, available_balance, credit_limit, interest_rate, is_active, icon, color, payment_day, cutoff_day, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'COP', ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
    [
      loanId,
      DEMO_USER_ID,
      "Credito Vehiculo Demo",
      "LOAN",
      "Banco Demo",
      6800000,
      null,
      null,
      17.8,
      "landmark",
      "#F97316",
      20,
      10,
      now,
      now,
    ]
  );

  for (const category of DEMO_CATEGORIES) {
    await db.runAsync(
      `INSERT INTO categories
        (id, user_id, name, name_es, icon, color, parent_id, is_system, display_order, created_at)
       VALUES (?, NULL, ?, ?, ?, ?, NULL, ?, ?, ?)`,
      [
        category.id,
        category.name,
        category.name_es,
        category.icon,
        category.color,
        category.is_system,
        category.display_order,
        now,
      ]
    );
  }

  const demoTransactions = [
    {
      accountId: checkingId,
      amount: 4200000,
      direction: "INFLOW",
      description: "Nomina Demo",
      date: dateShift(-15),
      categoryId: "a0000001-0001-4000-8000-000000000013",
    },
    {
      accountId: checkingId,
      amount: 168000,
      direction: "OUTFLOW",
      description: "Mercado semanal",
      date: dateShift(-10),
      categoryId: "a0000001-0001-4000-8000-000000000002",
    },
    {
      accountId: checkingId,
      amount: 89000,
      direction: "OUTFLOW",
      description: "Internet hogar",
      date: dateShift(-7),
      categoryId: "a0000001-0001-4000-8000-000000000004",
    },
    {
      accountId: creditCardId,
      amount: 320000,
      direction: "INFLOW",
      description: "Pago tarjeta desde cuenta principal",
      date: dateShift(-5),
      categoryId: "a0000001-0001-4000-8000-000000000019",
    },
    {
      accountId: loanId,
      amount: 510000,
      direction: "INFLOW",
      description: "Cuota credito vehiculo",
      date: dateShift(-2),
      categoryId: "a0000001-0001-4000-8000-000000000019",
    },
  ];

  for (const tx of demoTransactions) {
    await db.runAsync(
      `INSERT INTO transactions
        (id, user_id, account_id, category_id, amount, direction, description, merchant_name, raw_description, transaction_date, status, idempotency_key, is_excluded, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, 'POSTED', ?, 0, NULL, ?, ?)`,
      [
        Crypto.randomUUID(),
        DEMO_USER_ID,
        tx.accountId,
        tx.categoryId,
        tx.amount,
        tx.direction,
        tx.description,
        tx.date,
        Crypto.randomUUID(),
        now,
        now,
      ]
    );
  }

  await db.runAsync("DELETE FROM sync_queue");
  await db.runAsync("DELETE FROM sync_metadata");
}
