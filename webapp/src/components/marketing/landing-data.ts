import type { LucideIcon } from "lucide-react";
import {
  FileUp,
  Wallet,
  Users,
  Scale,
  Repeat2,
  Send,
  TrendingUp,
  Landmark,
  PiggyBank,
  BadgeDollarSign,
} from "lucide-react";

// ─── Hero mock data ───────────────────────────────────────────────────────────

export const LANDING_HERO_DATA = {
  availableToSpend: 1_850_000,
  spentToday: 87_500,
  dailyAllowance: 113_000,
  currency: "COP",
  monthMap: [
    { label: "Vivienda", pct: 32, color: "bg-z-brass" },
    { label: "Mercado", pct: 18, color: "bg-z-income" },
    { label: "Transporte", pct: 12, color: "bg-primary" },
    { label: "Salud", pct: 9, color: "bg-z-sage-light" },
    { label: "Ocio", pct: 7, color: "bg-z-alert" },
    { label: "Otros", pct: 22, color: "bg-white/20" },
  ],
} as const;

// ─── Budget mock data ─────────────────────────────────────────────────────────

export const LANDING_BUDGET_DATA: Array<{
  name: string;
  spent: number;
  budget: number;
  color: string;
  icon: string;
}> = [
  { name: "Vivienda", spent: 1_600_000, budget: 1_800_000, color: "#c9a84c", icon: "🏠" },
  { name: "Mercado", spent: 620_000, budget: 700_000, color: "#4caf82", icon: "🛒" },
  { name: "Transporte", spent: 280_000, budget: 350_000, color: "#6c8ebf", icon: "🚌" },
  { name: "Salud", spent: 95_000, budget: 200_000, color: "#7ab8a0", icon: "🏥" },
  { name: "Ocio", spent: 310_000, budget: 250_000, color: "#e07b54", icon: "🎭" },
  { name: "Suscripciones", spent: 72_000, budget: 100_000, color: "#a78bfa", icon: "📱" },
];

// ─── Plan (obligations) mock data ─────────────────────────────────────────────

export const LANDING_PLAN_DATA = {
  income: 3_420_000,
  committed: 1_870_000,
  available: 1_550_000,
  currency: "COP",
  obligations: [
    { name: "Arriendo", amount: 1_200_000, dueDate: "Lun 15", paid: true },
    { name: "Tarjeta principal", amount: 780_000, dueDate: "Vie 12", paid: false },
    { name: "Spotify + iCloud", amount: 48_000, dueDate: "Jue 18", paid: false },
    { name: "Internet", amount: 89_000, dueDate: "Mar 20", paid: true },
  ],
} as const;

// ─── Showcase panels ──────────────────────────────────────────────────────────

export type ShowcasePanel = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
};

export const LANDING_SHOWCASE_PANELS: ShowcasePanel[] = [
  {
    id: "import",
    title: "Importación de extractos",
    description: "Sube el PDF de tu banco y Zeta detecta cuentas, categoriza movimientos y te guía para conciliar duplicados.",
    icon: FileUp,
    gradient: "from-z-alert/20 via-z-alert/8 to-transparent",
  },
  {
    id: "dashboard",
    title: "Dashboard de margen diario",
    description: "Cuánto tienes disponible hoy, dónde está yendo la presión y qué vale la pena revisar primero.",
    icon: Wallet,
    gradient: "from-z-income/20 via-z-income/8 to-transparent",
  },
  {
    id: "recipients",
    title: "Destinatarios inteligentes",
    description: "Reglas que reconocen comercios frecuentes y los asignan automáticamente a categoría y presupuesto.",
    icon: Users,
    gradient: "from-primary/24 via-primary/10 to-transparent",
  },
  {
    id: "debt",
    title: "Estrategia de deuda",
    description: "Modela distintos escenarios de pago y entiende qué decisión libera presión más rápido.",
    icon: Scale,
    gradient: "from-z-debt/20 via-z-debt/8 to-transparent",
  },
  {
    id: "recurring",
    title: "Recurrentes y pagos próximos",
    description: "Pagos por venir visibles antes de que se vuelvan problema. Nunca más una sorpresa a fin de mes.",
    icon: Repeat2,
    gradient: "from-violet-300/20 via-violet-300/8 to-transparent",
  },
  {
    id: "capture",
    title: "Registro rápido",
    description: "Anota un gasto en segundos, sin abrir formularios. El sistema lo categoriza y lo conecta con tu plan.",
    icon: Send,
    gradient: "from-sky-400/20 via-sky-400/8 to-transparent",
  },
];

// ─── Features ─────────────────────────────────────────────────────────────────

export type Feature = {
  title: string;
  description: string;
  icon: LucideIcon;
  bullets: [string, string, string];
  accentClassName: string;
};

export const LANDING_FEATURES: Feature[] = [
  {
    title: "Dashboard que responde qué hacer hoy",
    description:
      "Zeta te muestra si vas bien, dónde se va la presión y qué vale la pena ajustar primero.",
    icon: TrendingUp,
    bullets: [
      "Resumen diario con foco en margen, gasto y próximas decisiones",
      "Señales visuales para saber si vas en control o corrigiendo",
      "Panel pensado para entender rápido, no para explorar de más",
    ],
    accentClassName: "from-z-income/20 via-z-income/8 to-transparent",
  },
  {
    title: "Importación de extractos PDF",
    description:
      "Subes tus extractos y Zeta organiza movimientos, detecta cuentas y ayuda a conciliar duplicados.",
    icon: Landmark,
    bullets: [
      "Compatible con bancos y billeteras usados en Colombia",
      "Preparado para revisar importaciones sin perder trazabilidad",
      "Convierte una tarea administrativa en un flujo guiado",
    ],
    accentClassName: "from-z-alert/20 via-z-alert/8 to-transparent",
  },
  {
    title: "Presupuesto 50/30/20 con contexto real",
    description:
      "No solo registra gastos: te muestra cuánto margen te queda y qué categoría está rompiendo el plan.",
    icon: PiggyBank,
    bullets: [
      "Vista por categorías y señales de sobreconsumo",
      "Asignación simple para gasto fijo, variable y ahorro",
      "Más útil que un presupuesto plano porque conecta con el resto del sistema",
    ],
    accentClassName: "from-primary/24 via-primary/10 to-transparent",
  },
  {
    title: "Deudas con estrategia, no solo saldo",
    description:
      "Modela pagos y entiende qué decisión libera presión antes. Ideal para tarjetas, cuotas y metas de salida.",
    icon: Scale,
    bullets: [
      "Visión del costo real de la deuda",
      "Planificador para priorizar pagos con intención",
      "Contexto para evitar que el pago mínimo dicte todo el mes",
    ],
    accentClassName: "from-z-debt/20 via-z-debt/8 to-transparent",
  },
  {
    title: "Cuentas y balances multi-moneda",
    description:
      "Si manejas COP, USD u otras monedas, puedes ver saldos y movimientos sin forzar una sola realidad.",
    icon: BadgeDollarSign,
    bullets: [
      "Cuentas separadas por moneda cuando hace falta",
      "Mejor lectura de efectivo real y compromisos",
      "Útil para freelancers, viajes o ingresos mixtos",
    ],
    accentClassName: "from-sky-400/20 via-sky-400/8 to-transparent",
  },
  {
    title: "Recurrentes, destinatarios y orden operativo",
    description:
      "Pagos por venir, reglas de destinatarios y bandejas para que lo repetitivo no te robe energía mental.",
    icon: Repeat2,
    bullets: [
      "Pagos próximos visibles antes de que se vuelvan problema",
      "Reglas para reconocer mejor movimientos frecuentes",
      "Flujos de gestión pensados para mantener el sistema limpio",
    ],
    accentClassName: "from-violet-300/20 via-violet-300/8 to-transparent",
  },
];

// ─── Workflow steps ───────────────────────────────────────────────────────────

export const LANDING_WORKFLOW: Array<{
  step: string;
  title: string;
  description: string;
}> = [
  {
    step: "01",
    title: "Sube tus extractos o crea tus cuentas",
    description:
      "Empiezas rápido con PDF o con carga manual. La idea es que el primer mapa financiero aparezca pronto.",
  },
  {
    step: "02",
    title: "Zeta organiza, agrupa y te muestra presión real",
    description:
      "Movimientos, presupuesto, deuda y recurrentes empiezan a hablar entre sí para mostrarte el estado del mes.",
  },
  {
    step: "03",
    title: "Decides con claridad diaria",
    description:
      "No necesitas adivinar qué corregir. El sistema te deja ver prioridades, riesgos y siguientes pasos.",
  },
];

// ─── FAQs ─────────────────────────────────────────────────────────────────────

export const LANDING_FAQS: Array<{ question: string; answer: string }> = [
  {
    question: "¿Zeta necesita conexión directa con mi banco?",
    answer:
      "No. El flujo principal está pensado alrededor de extractos PDF y registro controlado dentro de la app.",
  },
  {
    question: "¿Sirve si manejo varias cuentas o varias monedas?",
    answer:
      "Sí. La app contempla cuentas multi-moneda y te ayuda a no mezclar realidades distintas en un solo saldo.",
  },
  {
    question: "¿Es solo para registrar gastos?",
    answer:
      "No. La propuesta es ayudarte a decidir: presupuesto, deudas, pagos recurrentes, categorías y claridad diaria.",
  },
  {
    question: "¿Está pensada para Colombia?",
    answer:
      "Sí. El lenguaje, el enfoque y la importación por extractos están diseñados alrededor del uso financiero local.",
  },
];

// ─── Supported institutions ───────────────────────────────────────────────────

export const LANDING_INSTITUTIONS: string[] = [
  "Bancolombia",
  "Banco de Bogotá",
  "Davivienda",
  "Nu",
  "Falabella",
  "Nequi",
  "Popular",
  "Lulo",
  "Confiar",
];

// ─── Nav links ────────────────────────────────────────────────────────────────

export const LANDING_NAV_LINKS: Array<{ href: string; label: string }> = [
  { href: "#showcase", label: "Showcase" },
  { href: "#funciones", label: "Funciones" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#colombia", label: "Colombia" },
  { href: "#faq", label: "FAQ" },
];
