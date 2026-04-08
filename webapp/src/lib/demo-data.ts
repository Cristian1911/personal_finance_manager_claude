/**
 * Demo data definitions for Zeta preview mode.
 * Realistic Colombian personal finance data — 4 accounts, ~40 transactions
 * spread across the current and previous 2 months, plus budgets.
 */

import {
  CATEGORY_HOGAR,
  CATEGORY_ALIMENTACION,
  CATEGORY_TRANSPORTE,
  CATEGORY_SALUD,
  CATEGORY_ESTILO_DE_VIDA,
  CATEGORY_OBLIGACIONES,
  CATEGORY_INGRESOS,
  CATEGORY_OTROS_INGRESOS,
} from "@zeta/shared";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns YYYY-MM-DD for today + offset days */
function dateShift(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Returns YYYY-MM-DD for a specific day in the current or offset month */
function monthDay(monthOffset: number, day: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + monthOffset, day);
  return d.toISOString().slice(0, 10);
}

// ─── Demo Accounts ───────────────────────────────────────────────────────────

export interface DemoAccount {
  name: string;
  account_type: "CHECKING" | "SAVINGS" | "CREDIT_CARD" | "LOAN";
  institution_name: string;
  currency_code: "COP";
  current_balance: number;
  available_balance: number | null;
  credit_limit: number | null;
  interest_rate: number | null;
  icon: string | null;
  color: string;
  payment_day: number | null;
  cutoff_day: number | null;
  loan_amount: number | null;
  monthly_payment: number | null;
  show_in_dashboard: boolean;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    name: "Cuenta Nómina",
    account_type: "CHECKING",
    institution_name: "Bancolombia",
    currency_code: "COP",
    current_balance: 3_420_000,
    available_balance: null,
    credit_limit: null,
    interest_rate: null,
    icon: "building-2",
    color: "#10B981",
    payment_day: null,
    cutoff_day: null,
    loan_amount: null,
    monthly_payment: null,
    show_in_dashboard: true,
  },
  {
    name: "Ahorro Emergencia",
    account_type: "SAVINGS",
    institution_name: "Nu Colombia",
    currency_code: "COP",
    current_balance: 8_500_000,
    available_balance: null,
    credit_limit: null,
    interest_rate: 12.5,
    icon: "piggy-bank",
    color: "#8B5CF6",
    payment_day: null,
    cutoff_day: null,
    loan_amount: null,
    monthly_payment: null,
    show_in_dashboard: true,
  },
  {
    name: "Tarjeta Visa",
    account_type: "CREDIT_CARD",
    institution_name: "Davivienda",
    currency_code: "COP",
    current_balance: 1_240_000,
    available_balance: 3_760_000,
    credit_limit: 5_000_000,
    interest_rate: 28.5,
    icon: "credit-card",
    color: "#6366F1",
    payment_day: 18,
    cutoff_day: 8,
    loan_amount: null,
    monthly_payment: null,
    show_in_dashboard: true,
  },
  {
    name: "Crédito Vehículo",
    account_type: "LOAN",
    institution_name: "Banco de Bogotá",
    currency_code: "COP",
    current_balance: 14_800_000,
    available_balance: null,
    credit_limit: null,
    interest_rate: 16.9,
    icon: "landmark",
    color: "#F97316",
    payment_day: 25,
    cutoff_day: null,
    loan_amount: 25_000_000,
    monthly_payment: 680_000,
    show_in_dashboard: true,
  },
];

// ─── Demo Transactions ───────────────────────────────────────────────────────

export interface DemoTransaction {
  /** Index into DEMO_ACCOUNTS */
  accountIndex: number;
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  merchant_name: string;
  raw_description: string;
  category_id: string;
  transaction_date: string;
}

export function getDemoTransactions(): DemoTransaction[] {
  return [
    // ── Current month income ──
    {
      accountIndex: 0,
      amount: 5_200_000,
      direction: "INFLOW",
      merchant_name: "Empresa SAS",
      raw_description: "Nómina quincenal",
      category_id: CATEGORY_INGRESOS,
      transaction_date: monthDay(0, 1),
    },
    {
      accountIndex: 0,
      amount: 5_200_000,
      direction: "INFLOW",
      merchant_name: "Empresa SAS",
      raw_description: "Nómina quincenal",
      category_id: CATEGORY_INGRESOS,
      transaction_date: monthDay(0, 15),
    },
    {
      accountIndex: 0,
      amount: 350_000,
      direction: "INFLOW",
      merchant_name: "Freelance diseño",
      raw_description: "Pago freelance logo corporativo",
      category_id: CATEGORY_OTROS_INGRESOS,
      transaction_date: monthDay(0, 8),
    },

    // ── Current month expenses — checking ──
    {
      accountIndex: 0,
      amount: 1_850_000,
      direction: "OUTFLOW",
      merchant_name: "Arriendo Apto",
      raw_description: "Arriendo mensual apartamento",
      category_id: CATEGORY_HOGAR,
      transaction_date: monthDay(0, 1),
    },
    {
      accountIndex: 0,
      amount: 185_000,
      direction: "OUTFLOW",
      merchant_name: "EPM Medellín",
      raw_description: "Servicios públicos — agua, luz, gas",
      category_id: CATEGORY_HOGAR,
      transaction_date: monthDay(0, 5),
    },
    {
      accountIndex: 0,
      amount: 89_000,
      direction: "OUTFLOW",
      merchant_name: "Claro",
      raw_description: "Internet fibra óptica 300Mbps",
      category_id: CATEGORY_HOGAR,
      transaction_date: monthDay(0, 7),
    },
    {
      accountIndex: 0,
      amount: 320_000,
      direction: "OUTFLOW",
      merchant_name: "Éxito",
      raw_description: "Mercado semanal",
      category_id: CATEGORY_ALIMENTACION,
      transaction_date: monthDay(0, 3),
    },
    {
      accountIndex: 0,
      amount: 280_000,
      direction: "OUTFLOW",
      merchant_name: "D1",
      raw_description: "Mercado semanal",
      category_id: CATEGORY_ALIMENTACION,
      transaction_date: monthDay(0, 10),
    },
    {
      accountIndex: 0,
      amount: 45_000,
      direction: "OUTFLOW",
      merchant_name: "Rappi",
      raw_description: "Domicilio almuerzo",
      category_id: CATEGORY_ALIMENTACION,
      transaction_date: monthDay(0, 12),
    },
    {
      accountIndex: 0,
      amount: 120_000,
      direction: "OUTFLOW",
      merchant_name: "Terpel",
      raw_description: "Tanqueo gasolina",
      category_id: CATEGORY_TRANSPORTE,
      transaction_date: monthDay(0, 4),
    },
    {
      accountIndex: 0,
      amount: 65_000,
      direction: "OUTFLOW",
      merchant_name: "SOAT",
      raw_description: "Pago peaje y parqueadero",
      category_id: CATEGORY_TRANSPORTE,
      transaction_date: monthDay(0, 9),
    },
    {
      accountIndex: 0,
      amount: 250_000,
      direction: "OUTFLOW",
      merchant_name: "EPS Sura",
      raw_description: "Cita especialista",
      category_id: CATEGORY_SALUD,
      transaction_date: monthDay(0, 11),
    },

    // ── Credit card expenses ──
    {
      accountIndex: 2,
      amount: 78_000,
      direction: "OUTFLOW",
      merchant_name: "Netflix",
      raw_description: "Suscripción Netflix Premium",
      category_id: CATEGORY_ESTILO_DE_VIDA,
      transaction_date: monthDay(0, 2),
    },
    {
      accountIndex: 2,
      amount: 32_000,
      direction: "OUTFLOW",
      merchant_name: "Spotify",
      raw_description: "Suscripción Spotify Familiar",
      category_id: CATEGORY_ESTILO_DE_VIDA,
      transaction_date: monthDay(0, 2),
    },
    {
      accountIndex: 2,
      amount: 420_000,
      direction: "OUTFLOW",
      merchant_name: "Falabella",
      raw_description: "Ropa y accesorios",
      category_id: CATEGORY_ESTILO_DE_VIDA,
      transaction_date: monthDay(0, 6),
    },
    {
      accountIndex: 2,
      amount: 95_000,
      direction: "OUTFLOW",
      merchant_name: "Restaurante El Cielo",
      raw_description: "Cena con amigos",
      category_id: CATEGORY_ALIMENTACION,
      transaction_date: monthDay(0, 13),
    },

    // ── Debt payments (INFLOW to debt accounts) ──
    {
      accountIndex: 2,
      amount: 450_000,
      direction: "INFLOW",
      merchant_name: "Pago TC",
      raw_description: "Abono tarjeta crédito desde cuenta nómina",
      category_id: CATEGORY_OBLIGACIONES,
      transaction_date: monthDay(0, 15),
    },
    {
      accountIndex: 3,
      amount: 680_000,
      direction: "INFLOW",
      merchant_name: "Cuota crédito",
      raw_description: "Cuota mensual crédito vehículo",
      category_id: CATEGORY_OBLIGACIONES,
      transaction_date: monthDay(0, 25) > dateShift(0) ? dateShift(-5) : monthDay(0, 25),
    },

    // ── Previous month (month -1) ──
    {
      accountIndex: 0,
      amount: 5_200_000,
      direction: "INFLOW",
      merchant_name: "Empresa SAS",
      raw_description: "Nómina quincenal",
      category_id: CATEGORY_INGRESOS,
      transaction_date: monthDay(-1, 1),
    },
    {
      accountIndex: 0,
      amount: 5_200_000,
      direction: "INFLOW",
      merchant_name: "Empresa SAS",
      raw_description: "Nómina quincenal",
      category_id: CATEGORY_INGRESOS,
      transaction_date: monthDay(-1, 15),
    },
    {
      accountIndex: 0,
      amount: 1_850_000,
      direction: "OUTFLOW",
      merchant_name: "Arriendo Apto",
      raw_description: "Arriendo mensual apartamento",
      category_id: CATEGORY_HOGAR,
      transaction_date: monthDay(-1, 1),
    },
    {
      accountIndex: 0,
      amount: 175_000,
      direction: "OUTFLOW",
      merchant_name: "EPM Medellín",
      raw_description: "Servicios públicos",
      category_id: CATEGORY_HOGAR,
      transaction_date: monthDay(-1, 5),
    },
    {
      accountIndex: 0,
      amount: 89_000,
      direction: "OUTFLOW",
      merchant_name: "Claro",
      raw_description: "Internet fibra óptica",
      category_id: CATEGORY_HOGAR,
      transaction_date: monthDay(-1, 7),
    },
    {
      accountIndex: 0,
      amount: 340_000,
      direction: "OUTFLOW",
      merchant_name: "Éxito",
      raw_description: "Mercado semanal",
      category_id: CATEGORY_ALIMENTACION,
      transaction_date: monthDay(-1, 4),
    },
    {
      accountIndex: 0,
      amount: 295_000,
      direction: "OUTFLOW",
      merchant_name: "D1",
      raw_description: "Mercado semanal",
      category_id: CATEGORY_ALIMENTACION,
      transaction_date: monthDay(-1, 11),
    },
    {
      accountIndex: 0,
      amount: 150_000,
      direction: "OUTFLOW",
      merchant_name: "Terpel",
      raw_description: "Tanqueo gasolina",
      category_id: CATEGORY_TRANSPORTE,
      transaction_date: monthDay(-1, 6),
    },
    {
      accountIndex: 2,
      amount: 78_000,
      direction: "OUTFLOW",
      merchant_name: "Netflix",
      raw_description: "Suscripción Netflix Premium",
      category_id: CATEGORY_ESTILO_DE_VIDA,
      transaction_date: monthDay(-1, 2),
    },
    {
      accountIndex: 2,
      amount: 32_000,
      direction: "OUTFLOW",
      merchant_name: "Spotify",
      raw_description: "Suscripción Spotify Familiar",
      category_id: CATEGORY_ESTILO_DE_VIDA,
      transaction_date: monthDay(-1, 2),
    },
    {
      accountIndex: 2,
      amount: 380_000,
      direction: "INFLOW",
      merchant_name: "Pago TC",
      raw_description: "Abono tarjeta crédito",
      category_id: CATEGORY_OBLIGACIONES,
      transaction_date: monthDay(-1, 15),
    },
    {
      accountIndex: 3,
      amount: 680_000,
      direction: "INFLOW",
      merchant_name: "Cuota crédito",
      raw_description: "Cuota mensual crédito vehículo",
      category_id: CATEGORY_OBLIGACIONES,
      transaction_date: monthDay(-1, 25),
    },

    // ── Two months ago (month -2) ──
    {
      accountIndex: 0,
      amount: 5_200_000,
      direction: "INFLOW",
      merchant_name: "Empresa SAS",
      raw_description: "Nómina quincenal",
      category_id: CATEGORY_INGRESOS,
      transaction_date: monthDay(-2, 1),
    },
    {
      accountIndex: 0,
      amount: 5_200_000,
      direction: "INFLOW",
      merchant_name: "Empresa SAS",
      raw_description: "Nómina quincenal",
      category_id: CATEGORY_INGRESOS,
      transaction_date: monthDay(-2, 15),
    },
    {
      accountIndex: 0,
      amount: 1_850_000,
      direction: "OUTFLOW",
      merchant_name: "Arriendo Apto",
      raw_description: "Arriendo mensual",
      category_id: CATEGORY_HOGAR,
      transaction_date: monthDay(-2, 1),
    },
    {
      accountIndex: 0,
      amount: 190_000,
      direction: "OUTFLOW",
      merchant_name: "EPM Medellín",
      raw_description: "Servicios públicos",
      category_id: CATEGORY_HOGAR,
      transaction_date: monthDay(-2, 5),
    },
    {
      accountIndex: 0,
      amount: 89_000,
      direction: "OUTFLOW",
      merchant_name: "Claro",
      raw_description: "Internet fibra óptica",
      category_id: CATEGORY_HOGAR,
      transaction_date: monthDay(-2, 7),
    },
    {
      accountIndex: 0,
      amount: 310_000,
      direction: "OUTFLOW",
      merchant_name: "Éxito",
      raw_description: "Mercado semanal",
      category_id: CATEGORY_ALIMENTACION,
      transaction_date: monthDay(-2, 3),
    },
    {
      accountIndex: 0,
      amount: 260_000,
      direction: "OUTFLOW",
      merchant_name: "Jumbo",
      raw_description: "Mercado quincenal",
      category_id: CATEGORY_ALIMENTACION,
      transaction_date: monthDay(-2, 14),
    },
    {
      accountIndex: 0,
      amount: 130_000,
      direction: "OUTFLOW",
      merchant_name: "Terpel",
      raw_description: "Tanqueo gasolina",
      category_id: CATEGORY_TRANSPORTE,
      transaction_date: monthDay(-2, 8),
    },
    {
      accountIndex: 2,
      amount: 78_000,
      direction: "OUTFLOW",
      merchant_name: "Netflix",
      raw_description: "Suscripción Netflix",
      category_id: CATEGORY_ESTILO_DE_VIDA,
      transaction_date: monthDay(-2, 2),
    },
    {
      accountIndex: 2,
      amount: 32_000,
      direction: "OUTFLOW",
      merchant_name: "Spotify",
      raw_description: "Suscripción Spotify",
      category_id: CATEGORY_ESTILO_DE_VIDA,
      transaction_date: monthDay(-2, 2),
    },
    {
      accountIndex: 2,
      amount: 400_000,
      direction: "INFLOW",
      merchant_name: "Pago TC",
      raw_description: "Abono tarjeta crédito",
      category_id: CATEGORY_OBLIGACIONES,
      transaction_date: monthDay(-2, 15),
    },
    {
      accountIndex: 3,
      amount: 680_000,
      direction: "INFLOW",
      merchant_name: "Cuota crédito",
      raw_description: "Cuota mensual crédito vehículo",
      category_id: CATEGORY_OBLIGACIONES,
      transaction_date: monthDay(-2, 25),
    },
  ];
}

// ─── Demo Budgets ────────────────────────────────────────────────────────────

export interface DemoBudget {
  category_id: string;
  amount: number;
  period: "monthly";
}

export const DEMO_BUDGETS: DemoBudget[] = [
  { category_id: CATEGORY_HOGAR, amount: 2_200_000, period: "monthly" },
  { category_id: CATEGORY_ALIMENTACION, amount: 800_000, period: "monthly" },
  { category_id: CATEGORY_TRANSPORTE, amount: 250_000, period: "monthly" },
  { category_id: CATEGORY_SALUD, amount: 300_000, period: "monthly" },
  { category_id: CATEGORY_ESTILO_DE_VIDA, amount: 600_000, period: "monthly" },
  { category_id: CATEGORY_OBLIGACIONES, amount: 1_200_000, period: "monthly" },
];
