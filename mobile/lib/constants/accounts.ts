import {
  Wallet,
  PiggyBank,
  CreditCard,
  Banknote,
  TrendingUp,
  Landmark,
  CircleDot,
} from "lucide-react-native";

export const ACCOUNT_TYPES = [
  {
    value: "CHECKING",
    label: "Cuenta Corriente",
    shortLabel: "Corriente",
    icon: Wallet,
    description: "Cuenta de cheques para uso diario",
  },
  {
    value: "SAVINGS",
    label: "Cuenta de Ahorros",
    shortLabel: "Ahorros",
    icon: PiggyBank,
    description: "Ahorros con intereses",
  },
  {
    value: "CREDIT_CARD",
    label: "Tarjeta de Credito",
    shortLabel: "T. Credito",
    icon: CreditCard,
    description: "Tarjeta de credito con limite",
  },
  {
    value: "CASH",
    label: "Efectivo",
    shortLabel: "Efectivo",
    icon: Banknote,
    description: "Dinero en efectivo",
  },
  {
    value: "INVESTMENT",
    label: "Inversion",
    shortLabel: "Inversion",
    icon: TrendingUp,
    description: "CDT, fondos, acciones",
  },
  {
    value: "LOAN",
    label: "Prestamo",
    shortLabel: "Prestamo",
    icon: Landmark,
    description: "Deuda o prestamo por pagar",
  },
  {
    value: "OTHER",
    label: "Otro",
    shortLabel: "Otro",
    icon: CircleDot,
    description: "Cuenta personalizada",
  },
] as const;

export const CURRENCIES = [
  { code: "COP", name_es: "Peso Colombiano" },
  { code: "USD", name_es: "Dolar Estadounidense" },
  { code: "BRL", name_es: "Real Brasileno" },
  { code: "MXN", name_es: "Peso Mexicano" },
  { code: "EUR", name_es: "Euro" },
  { code: "PEN", name_es: "Sol Peruano" },
  { code: "CLP", name_es: "Peso Chileno" },
  { code: "ARS", name_es: "Peso Argentino" },
] as const;

export const PRESET_COLORS = [
  "#6366f1",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#6B7280",
] as const;

export type AccountTypeValue = (typeof ACCOUNT_TYPES)[number]["value"];
export type CurrencyCodeValue = (typeof CURRENCIES)[number]["code"];
