import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BanknoteArrowDown,
  BadgeDollarSign,
  Bot,
  CalendarClock,
  CalendarRange,
  Check,
  CheckCircle2,
  CreditCard,
  FileUp,
  Filter,
  Inbox,
  Landmark,
  Mic,
  PiggyBank,
  Repeat2,
  Scale,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BrandIcon } from "@/components/app/brand-icon";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Highlight = {
  value: string;
  label: string;
  detail: string;
};

type Feature = {
  title: string;
  description: string;
  icon: LucideIcon;
  bullets: string[];
  accentClassName: string;
};

type WorkflowStep = {
  step: string;
  title: string;
  description: string;
};

type Faq = {
  question: string;
  answer: string;
};

const highlights: Highlight[] = [
  {
    value: "Todo en una vista",
    label: "Prioridades visibles",
    detail: "Saldo, presupuesto, pagos cercanos y presión de deuda en el mismo lugar.",
  },
  {
    value: "PDF a decisiones",
    label: "Sin hojas de cálculo",
    detail: "Importa extractos y conviértelos en acciones claras, no en trabajo manual.",
  },
  {
    value: "Colombia primero",
    label: "Diseñado para tu realidad",
    detail: "Presupuesto, bancos locales, deudas y multi-moneda en el mismo flujo.",
  },
];

const features: Feature[] = [
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

const workflow: WorkflowStep[] = [
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

const faqs: Faq[] = [
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

const supportedInstitutions = [
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

const showcaseImportSteps = [
  "PDF",
  "Cuenta",
  "Destinatarios",
  "Revisión",
  "Conciliación",
] as const;

const showcaseAccounts = [
  {
    name: "Cuenta principal",
    detail: "COP · liquidez diaria",
    balance: "$4.8M",
    status: "Disponible",
    statusClassName: "bg-z-income/15 text-z-income",
  },
  {
    name: "Tarjeta viajera",
    detail: "USD · deuda activa",
    balance: "$1.2M",
    status: "Pago en 5 días",
    statusClassName: "bg-z-debt/15 text-z-debt",
  },
  {
    name: "Ahorro viaje",
    detail: "COP · objetivo",
    balance: "$920K",
    status: "62% meta",
    statusClassName: "bg-primary/15 text-primary",
  },
] as const;

const showcaseRecipients = [
  {
    name: "Rappi",
    rules: "4 reglas",
    spend: "$480K / mes",
    category: "Comida",
  },
  {
    name: "Éxito",
    rules: "2 reglas",
    spend: "$620K / mes",
    category: "Mercado",
  },
  {
    name: "Spotify",
    rules: "1 regla",
    spend: "$24K / mes",
    category: "Suscripciones",
  },
] as const;

const showcaseRecurringItems = [
  {
    label: "Tarjeta principal",
    date: "Vie 12",
    amount: "$780K",
    toneClassName: "text-z-debt",
  },
  {
    label: "Arriendo",
    date: "Lun 15",
    amount: "$1.6M",
    toneClassName: "text-z-alert",
  },
  {
    label: "Spotify + iCloud",
    date: "Jue 18",
    amount: "$48K",
    toneClassName: "text-z-sage-light",
  },
] as const;

const showcaseDebtPlans = [
  {
    name: "Solo mínimos",
    months: "28 meses",
    interest: "$4.1M",
    barWidth: "w-full",
    barClassName: "bg-white/18",
    badge: null,
  },
  {
    name: "Avalancha",
    months: "17 meses",
    interest: "$2.8M",
    barWidth: "w-[62%]",
    barClassName: "bg-z-income",
    badge: "Recomendado",
  },
  {
    name: "Balanceado",
    months: "20 meses",
    interest: "$3.1M",
    barWidth: "w-[72%]",
    barClassName: "bg-z-brass",
    badge: null,
  },
] as const;

const showcaseQuickCaptureMessages = [
  { role: "system", text: "Di tu movimiento o escríbelo abajo." },
  { role: "user", text: "Gasté 15 mil en café ayer" },
  { role: "system", text: "Listo. Detecté gasto por $15.000 en café." },
] as const;

function ShowcasePanel({
  eyebrow,
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={`overflow-hidden border-white/8 bg-white/[0.03] py-0 shadow-2xl shadow-black/10 ${className ?? ""}`}
    >
      <CardHeader className="gap-4 px-6 py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-z-sage-light">
              {eyebrow}
            </p>
            <div className="space-y-2">
              <CardTitle className="text-2xl">{title}</CardTitle>
              <CardDescription className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {description}
              </CardDescription>
            </div>
          </div>
          <div className="hidden size-11 items-center justify-center rounded-2xl border border-white/10 bg-black/20 lg:flex">
            <Icon className="size-5 text-z-sage-light" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6">{children}</CardContent>
    </Card>
  );
}

function MockShell({
  title,
  children,
  mobile = false,
}: {
  title: string;
  children: ReactNode;
  mobile?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden border border-white/8 bg-[#101111]/95 shadow-[0_20px_80px_rgba(0,0,0,0.28)] ${
        mobile ? "mx-auto max-w-[23rem] rounded-[2rem] p-2.5" : "rounded-[1.75rem] p-3"
      }`}
    >
      <div className="rounded-[1.15rem] border border-white/6 bg-black/25 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-z-brass/70" />
              <span className="size-2 rounded-full bg-z-sage-light/70" />
              <span className="size-2 rounded-full bg-white/35" />
            </div>
            <p className="text-xs font-medium text-z-white/82">{title}</p>
          </div>
          <Badge
            variant="outline"
            className="border-white/10 bg-white/5 text-[10px] uppercase tracking-[0.18em] text-z-sage-light"
          >
            Zeta
          </Badge>
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function MockMetric({
  label,
  value,
  context,
  valueClassName,
}: {
  label: string;
  value: string;
  context: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/6 bg-black/12 p-4">
      <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      <p className={`mt-3 text-2xl font-semibold ${valueClassName ?? "text-z-white"}`}>
        {value}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{context}</p>
    </div>
  );
}

function MockProgress({
  label,
  value,
  fillClassName,
}: {
  label: string;
  value: string;
  fillClassName: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 rounded-full bg-white/8">
        <div className={`h-2 rounded-full ${fillClassName}`} />
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl space-y-4">
      <Badge
        variant="outline"
        className="border-white/10 bg-white/4 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-z-sage-light"
      >
        {eyebrow}
      </Badge>
      <div className="space-y-3">
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {title}
        </h2>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          {description}
        </p>
      </div>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  icon: Icon,
  bullets,
  accentClassName,
}: Feature) {
  return (
    <Card className="relative overflow-hidden border-white/8 bg-white/[0.03] py-0 shadow-2xl shadow-black/10">
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b ${accentClassName}`}
      />
      <CardHeader className="relative gap-4 px-6 pt-6">
        <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
          <Icon className="size-5 text-z-sage-light" />
        </div>
        <div className="space-y-2">
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription className="text-sm leading-6 text-muted-foreground">
            {description}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <ul className="space-y-3 text-sm leading-6 text-z-white/86">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-z-income" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function MarketingLandingPage() {
  return (
    <div className="relative overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(197,191,174,0.14),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(82,183,136,0.14),transparent_22%),radial-gradient(circle_at_50%_65%,rgba(244,162,97,0.12),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-[-18rem] h-[32rem] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(197,191,174,0.16),transparent,rgba(233,196,106,0.12),transparent,rgba(82,183,136,0.1),transparent)] blur-3xl" />

      <header className="relative border-b border-white/6 bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <BrandIcon
              className="size-10 rounded-2xl border border-white/10 shadow-lg shadow-black/15"
              priority
            />
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-z-sage-light uppercase">
                Zeta
              </p>
              <p className="text-xs text-muted-foreground">
                Finanzas personales con claridad diaria
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#showcase" className="transition-colors hover:text-foreground">
              Showcase
            </a>
            <a href="#funciones" className="transition-colors hover:text-foreground">
              Funciones
            </a>
            <a href="#como-funciona" className="transition-colors hover:text-foreground">
              Cómo funciona
            </a>
            <a href="#colombia" className="transition-colors hover:text-foreground">
              Colombia
            </a>
            <a href="#faq" className="transition-colors hover:text-foreground">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link href="/login">Entrar</Link>
            </Button>
            <Button
              asChild
              className="rounded-full bg-primary px-5 text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
            >
              <Link href="/signup">Crear cuenta</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative">
        <section className="mx-auto max-w-7xl px-6 pb-20 pt-16 sm:pt-24">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(24rem,0.9fr)] lg:items-center">
            <div className="space-y-8">
              <Badge className="rounded-full bg-primary/14 px-4 py-1.5 text-xs font-medium text-z-sage-light">
                Zeta te ayuda a responder una sola pregunta: ¿vas bien o necesitas ajustar hoy?
              </Badge>

              <div className="space-y-6">
                <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-7xl">
                  Tu dinero deja de sentirse confuso y empieza a contar una historia clara.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
                  Zeta reúne extractos, presupuesto, deudas, cuentas y pagos
                  recurrentes para darte una vista accionable de tus finanzas
                  personales en Colombia.
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="rounded-full bg-primary px-7 text-primary-foreground shadow-lg shadow-primary/20"
                >
                  <Link href="/signup">
                    Quiero probar Zeta
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="rounded-full border-white/10 bg-white/4 px-7 text-foreground hover:bg-white/8"
                >
                  <a href="#funciones">Ver todo lo que hace</a>
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {highlights.map((highlight) => (
                  <div
                    key={highlight.label}
                    className="rounded-3xl border border-white/8 bg-white/[0.03] p-5 shadow-lg shadow-black/10"
                  >
                    <p className="text-sm font-semibold text-z-sage-light">
                      {highlight.value}
                    </p>
                    <p className="mt-2 text-base font-medium">{highlight.label}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {highlight.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-b from-primary/18 via-transparent to-z-income/10 blur-2xl" />
              <Card className="relative overflow-hidden rounded-[2rem] border-white/10 bg-[#111111]/90 py-0 shadow-2xl shadow-black/35">
                <div className="border-b border-white/8 px-6 py-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-z-sage-light">
                        Vista de claridad diaria
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Una lectura pensada para decidir sin abrir diez tablas
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-z-income/25 bg-z-income/10 text-z-income"
                    >
                      En control
                    </Badge>
                  </div>
                </div>

                <div className="grid gap-4 px-6 py-6 sm:grid-cols-3">
                  <div className="rounded-3xl border border-white/8 bg-white/4 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                      Ingreso visto
                    </p>
                    <p className="mt-3 text-2xl font-semibold">$7.200.000</p>
                    <p className="mt-2 flex items-center gap-2 text-xs text-z-income">
                      <BanknoteArrowDown className="size-3.5" />
                      +12% frente al mes pasado
                    </p>
                  </div>
                  <div className="rounded-3xl border border-white/8 bg-white/4 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                      Margen libre
                    </p>
                    <p className="mt-3 text-2xl font-semibold">$1.180.000</p>
                    <p className="mt-2 flex items-center gap-2 text-xs text-z-sage-light">
                      <Target className="size-3.5" />
                      Listo para ahorro o deuda
                    </p>
                  </div>
                  <div className="rounded-3xl border border-white/8 bg-white/4 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                      Próximo foco
                    </p>
                    <p className="mt-3 text-2xl font-semibold">2 pagos</p>
                    <p className="mt-2 flex items-center gap-2 text-xs text-z-alert">
                      <CalendarClock className="size-3.5" />
                      En los próximos 7 días
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 border-t border-white/8 px-6 py-6 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-4 rounded-[1.75rem] border border-white/8 bg-white/[0.03] p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Mapa del mes</p>
                        <p className="text-xs text-muted-foreground">
                          Lo importante, sin saturación
                        </p>
                      </div>
                      <Sparkles className="size-4 text-z-sage-light" />
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Presupuesto esencial</span>
                          <span>76%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/8">
                          <div className="h-2 w-[76%] rounded-full bg-z-income" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Deuda bajo presión</span>
                          <span>48%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/8">
                          <div className="h-2 w-[48%] rounded-full bg-z-debt" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Ahorro de objetivo</span>
                          <span>62%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/8">
                          <div className="h-2 w-[62%] rounded-full bg-primary" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-[1.75rem] border border-white/8 bg-black/20 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Decisiones próximas</p>
                        <p className="text-xs text-muted-foreground">
                          Para que no se acumulen sorpresas
                        </p>
                      </div>
                      <ShieldCheck className="size-4 text-z-sage-light" />
                    </div>

                    {[
                      {
                        icon: CreditCard,
                        label: "Tarjeta principal",
                        meta: "Pagar antes del viernes",
                        tone: "text-z-debt",
                      },
                      {
                        icon: Repeat2,
                        label: "Servicios recurrentes",
                        meta: "3 cargos por confirmar",
                        tone: "text-z-alert",
                      },
                      {
                        icon: BadgeDollarSign,
                        label: "Cuenta en USD",
                        meta: "Saldo y movimientos visibles aparte",
                        tone: "text-sky-300",
                      },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.label}
                          className="flex items-center gap-3 rounded-2xl border border-white/6 bg-white/4 px-4 py-3"
                        >
                          <div className="flex size-10 items-center justify-center rounded-2xl bg-white/6">
                            <Icon className={`size-4 ${item.tone}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{item.label}</p>
                            <p className="text-xs text-muted-foreground">{item.meta}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>

        <section id="showcase" className="mx-auto max-w-7xl px-6 py-20">
          <SectionHeading
            eyebrow="Showcase"
            title="Explora la experiencia real de Zeta"
            description="Zeta no es solo una promesa. Aquí puedes ver cómo se siente usar el dashboard, importar extractos, gestionar tus cuentas y planificar tu futuro financiero con nuestra interfaz real."
          />

          <div className="mt-12 space-y-6">
            <ShowcasePanel
              eyebrow="Inicio"
              title="Control diario con una sola lectura"
              description="La capa principal de Zeta junta liquidez, foco operativo y señales de atención en una superficie que responde rápido si el mes va sano o necesita corrección."
              icon={TrendingUp}
            >
              <MockShell title="Inicio / Marzo">
                <div className="grid gap-3 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-[1.35rem] border border-white/6 bg-[linear-gradient(180deg,rgba(147,120,68,0.16),rgba(17,17,17,0.82)_55%,rgba(17,17,17,0.95))] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-z-sage-light">
                          Tu estado financiero de hoy
                        </p>
                        <p className="mt-2 text-2xl font-semibold">
                          Vas en control, pero hay 2 focos que conviene resolver esta semana.
                        </p>
                      </div>
                      <Badge className="bg-z-income/14 text-z-income">En control</Badge>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <MockMetric
                        label="Ingreso visto"
                        value="$7.2M"
                        context="+12% frente al mes pasado"
                        valueClassName="text-z-income"
                      />
                      <MockMetric
                        label="Margen libre"
                        value="$1.18M"
                        context="Listo para ahorro o deuda"
                      />
                      <MockMetric
                        label="Próximo foco"
                        value="2 pagos"
                        context="Durante los próximos 7 días"
                        valueClassName="text-z-alert"
                      />
                    </div>
                  </div>

                  <div className="rounded-[1.35rem] border border-z-brass/20 bg-z-surface-2/80 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-brass">
                      Necesita atención
                    </p>
                    <div className="mt-3 space-y-2">
                      {[
                        "1 tarjeta por pagar antes del viernes",
                        "3 suscripciones por confirmar",
                        "2 movimientos siguen sin categoría",
                      ].map((item, index) => (
                        <div
                          key={item}
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-black/10 px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="flex size-5 items-center justify-center rounded-full bg-z-brass/15 text-[10px] font-bold text-z-brass">
                              {index + 1}
                            </span>
                            <span className="text-sm">{item}</span>
                          </div>
                          <span className="text-xs font-medium text-z-brass">Resolver →</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_0.95fr]">
                  <div className="rounded-[1.25rem] border border-white/6 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Mapa del mes</p>
                        <p className="text-xs text-muted-foreground">
                          Presupuesto, deuda y objetivos en la misma vista
                        </p>
                      </div>
                      <Sparkles className="size-4 text-z-sage-light" />
                    </div>
                    <div className="mt-4 space-y-4">
                      <MockProgress
                        label="Presupuesto esencial"
                        value="76%"
                        fillClassName="w-[76%] bg-z-income"
                      />
                      <MockProgress
                        label="Deuda bajo presión"
                        value="48%"
                        fillClassName="w-[48%] bg-z-debt"
                      />
                      <MockProgress
                        label="Ahorro objetivo"
                        value="62%"
                        fillClassName="w-[62%] bg-primary"
                      />
                    </div>
                  </div>

                  <div className="rounded-[1.25rem] border border-white/6 bg-black/14 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Últimos movimientos</p>
                        <p className="text-xs text-muted-foreground">
                          Para seguir el pulso sin abrir tablas pesadas
                        </p>
                      </div>
                      <WalletCards className="size-4 text-z-sage-light" />
                    </div>
                    <div className="mt-4 space-y-3">
                      {[
                        {
                          title: "Nómina",
                          meta: "Hoy · Cuenta principal",
                          amount: "+$4.200.000",
                          toneClassName: "text-z-income",
                        },
                        {
                          title: "Supermercado",
                          meta: "Ayer · Éxito",
                          amount: "-$182.400",
                          toneClassName: "text-z-white",
                        },
                        {
                          title: "Tarjeta viajera",
                          meta: "Lun · Pago manual",
                          amount: "-$620.000",
                          toneClassName: "text-z-debt",
                        },
                      ].map((item) => (
                        <div
                          key={item.title}
                          className="flex items-center justify-between rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2.5"
                        >
                          <div>
                            <p className="text-sm font-medium">{item.title}</p>
                            <p className="text-xs text-muted-foreground">{item.meta}</p>
                          </div>
                          <p className={`text-sm font-semibold ${item.toneClassName}`}>
                            {item.amount}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </MockShell>
            </ShowcasePanel>

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <ShowcasePanel
                eyebrow="Importar"
                title="Extractos que actualizan el sistema completo"
                description="El flujo no se queda en subir un PDF: asocia cuentas, aprende destinatarios y revisa duplicados antes de escribir en la base."
                icon={FileUp}
              >
                <MockShell title="Importar extracto">
                  <div className="flex flex-wrap gap-2">
                    {showcaseImportSteps.map((step, index) => (
                      <Badge
                        key={step}
                        variant="outline"
                        className={`border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${
                          index === 2
                            ? "bg-z-brass/12 text-z-brass"
                            : "bg-white/[0.03] text-z-white/70"
                        }`}
                      >
                        {step}
                      </Badge>
                    ))}
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
                    <div className="rounded-[1.25rem] border border-dashed border-white/12 bg-black/12 p-4">
                      <div className="rounded-[1.1rem] border border-white/8 bg-white/[0.03] p-4">
                        <p className="text-sm font-medium">extracto_marzo.pdf</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Bancolombia · 186 movimientos detectados
                        </p>
                        <div className="mt-4 rounded-xl border border-white/6 bg-black/20 p-3">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-z-sage-light">
                            Cuenta sugerida
                          </p>
                          <p className="mt-2 text-lg font-semibold">Cuenta principal</p>
                          <p className="text-xs text-muted-foreground">
                            Coincide por número, moneda y saldo final
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <MockMetric label="Cuentas listas" value="6" context="bases para asociar" />
                        <MockMetric label="Reglas aprendidas" value="24" context="destinatarios listos" />
                        <MockMetric label="Duplicados" value="3" context="por revisar" />
                      </div>
                      <div className="rounded-[1.25rem] border border-white/6 bg-z-surface-2/80 p-4">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-z-sage-light">
                          Revisión final
                        </p>
                        <div className="mt-3 space-y-2">
                          {[
                            "Éxito Laureles · Mercado · Confirmado",
                            "Pago TC Visa · Deuda · Conciliar con manual",
                            "Spotify · Suscripciones · Crear regla",
                          ].map((row) => (
                            <div
                              key={row}
                              className="flex items-center justify-between rounded-xl border border-white/6 bg-black/10 px-3 py-2"
                            >
                              <span className="text-sm">{row}</span>
                              <span className="text-xs text-z-sage-light">OK</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </MockShell>
              </ShowcasePanel>

              <ShowcasePanel
                eyebrow="Cuentas"
                title="Liquidez, deuda y patrimonio sin mezclar realidades"
                description="La organización por tipo de cuenta facilita leer presión, capacidad de maniobra y balances multi-moneda."
                icon={Wallet}
              >
                <MockShell title="Cuentas">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <MockMetric label="Patrimonio neto" value="$8.4M" context="base visible hoy" />
                    <MockMetric label="Cuentas activas" value="6" context="3 liquidez · 2 deuda" />
                    <MockMetric
                      label="Presión de deuda"
                      value="2"
                      context="con saldo pendiente"
                      valueClassName="text-z-debt"
                    />
                  </div>
                  <div className="mt-3 grid gap-3">
                    {showcaseAccounts.map((account) => (
                      <div
                        key={account.name}
                        className="flex items-center justify-between rounded-[1.1rem] border border-white/6 bg-white/[0.03] px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium">{account.name}</p>
                          <p className="text-xs text-muted-foreground">{account.detail}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold">{account.balance}</p>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${account.statusClassName}`}
                          >
                            {account.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </MockShell>
              </ShowcasePanel>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <ShowcasePanel
                eyebrow="Destinatarios"
                title="Comercios, reglas y gasto agrupados en la misma capa"
                description="El showcase aterriza la lógica de destinatarios: búsqueda, filtros, reglas activas y gasto mensual por comercio."
                icon={Search}
              >
                <MockShell title="Destinatarios">
                  <div className="flex items-center gap-2 rounded-[1.1rem] border border-white/6 bg-black/12 px-3 py-2.5">
                    <Search className="size-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Buscar destinatario...</span>
                    <Filter className="ml-auto size-4 text-z-sage-light" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["Todos", "Comida", "Mercado", "Suscripciones"].map((pill, index) => (
                      <Badge
                        key={pill}
                        variant="outline"
                        className={`border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${
                          index === 0
                            ? "bg-z-sage-light/12 text-z-sage-light"
                            : "bg-white/[0.03] text-z-white/70"
                        }`}
                      >
                        {pill}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-3 space-y-3">
                    {showcaseRecipients.map((recipient) => (
                      <div
                        key={recipient.name}
                        className="rounded-[1.15rem] border border-white/6 bg-white/[0.03] px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{recipient.name}</p>
                            <p className="text-xs text-muted-foreground">{recipient.rules}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">{recipient.spend}</p>
                            <span className="text-xs text-z-sage-light">{recipient.category}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </MockShell>
              </ShowcasePanel>

              <ShowcasePanel
                eyebrow="Deuda + Plan"
                title="Simulación que cambia decisiones, no solo números"
                description="La comparación entre planes deja visible tiempo, intereses y una recomendación clara antes de comprometer el próximo pago."
                icon={Scale}
              >
                <MockShell title="Planificador de deuda">
                  <div className="flex flex-wrap gap-2">
                    {showcaseDebtPlans.map((plan) => (
                      <Badge
                        key={plan.name}
                        variant="outline"
                        className={`border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${
                          plan.badge ? "bg-z-income/12 text-z-income" : "bg-white/[0.03] text-z-white/70"
                        }`}
                      >
                        {plan.name}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="rounded-[1.25rem] border border-white/6 bg-black/12 p-4">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-z-sage-light">
                        Resumen de planes
                      </p>
                      <div className="mt-3 space-y-3">
                        {showcaseDebtPlans.map((plan) => (
                          <div key={plan.name} className="space-y-1.5">
                            <div className="flex items-center justify-between text-sm">
                              <span>{plan.name}</span>
                              <span className="text-muted-foreground">{plan.months}</span>
                            </div>
                            <div className="h-2 rounded-full bg-white/8">
                              <div className={`h-2 rounded-full ${plan.barWidth} ${plan.barClassName}`} />
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>Intereses</span>
                              <span>{plan.interest}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[1.25rem] border border-white/6 bg-z-surface-2/80 p-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <MockMetric label="Deudas activas" value="4" context="saldo pendiente" />
                        <MockMetric
                          label="Tiempo libre"
                          value="11 meses"
                          context="menos vs mínimos"
                          valueClassName="text-z-income"
                        />
                        <MockMetric
                          label="Intereses evitados"
                          value="$1.3M"
                          context="con avalancha"
                          valueClassName="text-z-income"
                        />
                      </div>
                      <div className="mt-3 rounded-[1.1rem] border border-z-income/20 bg-z-income/8 p-4">
                        <p className="text-sm font-medium text-z-income">
                          El plan “Avalancha” ahorra más intereses y te deja libre de deuda antes.
                        </p>
                      </div>
                    </div>
                  </div>
                </MockShell>
              </ShowcasePanel>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <ShowcasePanel
                eyebrow="Recurrentes"
                title="Obligaciones fijas que aparecen antes del problema"
                description="Visualiza tus plantillas activas, compromiso mensual y próximos cargos en una sola vista."
                icon={Repeat2}
              >
                <MockShell title="Recurrentes">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <MockMetric label="Plantillas activas" value="9" context="rutinas vivas" />
                    <MockMetric label="Salidas / mes" value="$2.9M" context="compromiso fijo" />
                    <MockMetric label="Entradas / mes" value="$6.5M" context="ingreso recurrente" />
                  </div>
                  <div className="mt-3 space-y-3 rounded-[1.2rem] border border-white/6 bg-black/14 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Próximos 14 días</p>
                        <p className="text-xs text-muted-foreground">
                          La línea de tiempo operativa del mes
                        </p>
                      </div>
                      <CalendarRange className="size-4 text-z-sage-light" />
                    </div>
                    {showcaseRecurringItems.map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2.5"
                      >
                        <div>
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.date}</p>
                        </div>
                        <p className={`text-sm font-semibold ${item.toneClassName}`}>
                          {item.amount}
                        </p>
                      </div>
                    ))}
                  </div>
                </MockShell>
              </ShowcasePanel>

              <ShowcasePanel
                eyebrow="Quick capture"
                title="Captura rápida que sí parece parte del producto"
                description="Registra movimientos por voz o texto sin romper tu flujo. Una interfaz rápida y natural diseñada para capturar la realidad de tu gasto al instante."
                icon={Mic}
              >
                <div className="grid gap-4 lg:grid-cols-[0.7fr_0.3fr] lg:items-start">
                  <MockShell title="Captura rápida" mobile>
                    <div className="rounded-[1.5rem] border border-white/6 bg-z-surface-2/80 p-4">
                      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/6 bg-black/14 px-3 py-1.5 text-xs text-muted-foreground">
                        <Wallet className="size-3.5 text-z-sage-light" />
                        Cuenta principal
                      </div>

                      <div className="space-y-3">
                        {showcaseQuickCaptureMessages.map((message) => (
                          <div
                            key={message.text}
                            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                                message.role === "user"
                                  ? "rounded-br-md bg-z-brass/14 text-z-white"
                                  : "rounded-bl-md bg-white/[0.05] text-z-white/84"
                              }`}
                            >
                              {message.text}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 rounded-[1.15rem] border border-white/6 bg-black/16 p-4">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Resumen detectado</span>
                          <span>COP</span>
                        </div>
                        <p className="mt-2 text-2xl font-semibold text-z-debt">$15.000</p>
                        <p className="text-sm text-z-white/84">Café · Ayer · Gasto</p>
                        <Button className="mt-4 w-full rounded-full bg-primary text-primary-foreground">
                          <Check className="size-4" />
                          Registrar movimiento
                        </Button>
                      </div>

                      <div className="mt-4 flex items-center gap-2 rounded-full border border-white/6 bg-black/16 px-3 py-2">
                        <Mic className="size-4 text-z-brass" />
                        <span className="flex-1 text-sm text-muted-foreground">
                          Ej: gasté 15 mil en café
                        </span>
                        <span className="flex size-8 items-center justify-center rounded-full bg-z-brass text-z-ink">
                          <Send className="size-4" />
                        </span>
                      </div>
                    </div>
                  </MockShell>

                  <div className="grid gap-4">
                    <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4">
                      <div className="flex items-center gap-2">
                        <Inbox className="size-4 text-z-sage-light" />
                        <p className="text-sm font-medium">Integración con Telegram</p>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Registra gastos desde cualquier lugar con nuestra integración oficial de mensajería.
                      </p>
                    </div>
                    <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4">
                      <div className="flex items-center gap-2">
                        <Bot className="size-4 text-z-sage-light" />
                        <p className="text-sm font-medium">Asistente inteligente</p>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Conecta Zeta con tus herramientas de productividad favoritas mediante nuestro asistente MCP.
                      </p>
                    </div>
                  </div>
                </div>
              </ShowcasePanel>
            </div>
          </div>
        </section>

        <section id="funciones" className="mx-auto max-w-7xl px-6 py-20">
          <SectionHeading
            eyebrow="Lo que hace"
            title="Un sistema completo para entender tus finanzas y actuar con intención."
            description="Zeta no es una planilla bonita. Es una capa de claridad sobre tu realidad financiera: extractos, cuentas, presupuesto, pagos y deuda alineados en una sola experiencia."
          />

          <div className="mt-12 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {features.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-20">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <Card className="overflow-hidden border-white/8 bg-white/[0.03] py-0">
              <CardHeader className="gap-4 px-8 py-8">
                <Badge
                  variant="outline"
                  className="border-white/10 bg-white/4 text-z-sage-light"
                >
                  Para quién encaja
                </Badge>
                <div className="space-y-2">
                  <CardTitle className="text-3xl">
                    Para personas que quieren control sin convertirse en contadores.
                  </CardTitle>
                  <CardDescription className="max-w-2xl text-base leading-7 text-muted-foreground">
                    Si hoy llevas tus finanzas a medias, mezclas cuentas, usas
                    notas sueltas o sientes que cada quincena vuelves a empezar,
                    Zeta está construida para ti.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 px-8 pb-8 md:grid-cols-2">
                {[
                  "Profesionales que cobran y gastan en varias cuentas",
                  "Personas que quieren ordenar tarjetas y cuotas sin ansiedad",
                  "Hogares que necesitan ver si el mes está sano o apretado",
                  "Quienes ya intentaron con Excel, notas o apps genéricas y no conectaron todo",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-3xl border border-white/8 bg-black/20 p-5 text-sm leading-6 text-z-white/86"
                  >
                    <div className="mb-3 flex size-10 items-center justify-center rounded-2xl bg-white/6">
                      <CheckCircle2 className="size-4 text-z-income" />
                    </div>
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card
              id="colombia"
              className="overflow-hidden border-white/8 bg-[linear-gradient(180deg,rgba(197,191,174,0.08),rgba(255,255,255,0.02))] py-0"
            >
              <CardHeader className="gap-4 px-8 py-8">
                <Badge className="bg-z-alert/14 text-z-alert">
                  Hecho para Colombia
                </Badge>
                <div className="space-y-2">
                  <CardTitle className="text-3xl">
                    El punto de partida es tu realidad local.
                  </CardTitle>
                  <CardDescription className="text-base leading-7 text-muted-foreground">
                    Importación por extractos PDF, lenguaje claro y flujos
                    pensados para bancos, tarjetas y hábitos comunes aquí.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 px-8 pb-8">
                <div className="flex flex-wrap gap-2">
                  {supportedInstitutions.map((institution) => (
                    <Badge
                      key={institution}
                      variant="outline"
                      className="border-white/10 bg-black/18 px-3 py-1 text-z-white/80"
                    >
                      {institution}
                    </Badge>
                  ))}
                </div>

                <div className="rounded-3xl border border-white/8 bg-black/20 p-5">
                  <p className="text-sm font-medium text-z-sage-light">
                    Lo importante no es solo importar.
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Lo valioso es que, una vez entra la información, Zeta la
                    convierte en contexto: presupuesto, deuda, pagos próximos,
                    categorías y balances en una misma lectura.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="como-funciona" className="mx-auto max-w-7xl px-6 py-20">
          <SectionHeading
            eyebrow="Cómo funciona"
            title="Tres pasos para pasar del ruido financiero a una rutina clara."
            description="La experiencia está pensada para que el valor aparezca pronto y se sostenga durante el mes sin exigir mantenimiento pesado."
          />

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {workflow.map((item) => (
              <Card
                key={item.step}
                className="border-white/8 bg-white/[0.03] py-0 shadow-lg shadow-black/10"
              >
                <CardHeader className="gap-4 px-6 py-6">
                  <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-sm font-semibold text-z-sage-light">
                    {item.step}
                  </div>
                  <div className="space-y-2">
                    <CardTitle className="text-2xl">{item.title}</CardTitle>
                    <CardDescription className="text-sm leading-6 text-muted-foreground">
                      {item.description}
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-20">
          <Card className="overflow-hidden rounded-[2rem] border-white/8 bg-[linear-gradient(135deg,rgba(197,191,174,0.16),rgba(17,17,17,0.72)_38%,rgba(82,183,136,0.12))] py-0">
            <div className="grid gap-8 px-8 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:py-12">
              <div className="space-y-5">
                <Badge className="bg-black/20 text-z-sage-light">
                  Lista para publicidad y crecimiento
                </Badge>
                <h2 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance">
                  Una propuesta simple de contar: claridad diaria para tus
                  finanzas personales.
                </h2>
                <p className="max-w-2xl text-base leading-7 text-z-white/82">
                  Este landing deja visible la historia completa de Zeta:
                  importación, control, presupuesto, deuda, cuentas y una forma
                  más clara de decidir. Es una base fuerte para pauta, SEO y
                  presentaciones del producto.
                </p>
                <div className="flex flex-col gap-4 sm:flex-row">
                  <Button
                    asChild
                    size="lg"
                    className="rounded-full bg-primary px-7 text-primary-foreground"
                  >
                    <Link href="/signup">
                      Crear mi cuenta
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="rounded-full border-white/14 bg-black/12 px-7 text-foreground hover:bg-black/20"
                  >
                    <Link href="/login">Ya tengo cuenta</Link>
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  {
                    icon: Target,
                    title: "Mensaje claro",
                    description:
                      "Habla de control, prioridades y decisiones. No solo de registro.",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Base creíble",
                    description:
                      "Muestra funciones reales del producto actual, no promesas vacías.",
                  },
                  {
                    icon: Landmark,
                    title: "Ventaja local",
                    description:
                      "Importación por extractos y enfoque pensado para Colombia.",
                  },
                  {
                    icon: Repeat2,
                    title: "Escalable",
                    description:
                      "Sirve hoy en la misma app y mañana bajo un dominio de marketing.",
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.title}
                      className="rounded-[1.75rem] border border-white/10 bg-black/18 p-5"
                    >
                      <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-white/8">
                        <Icon className="size-5 text-z-sage-light" />
                      </div>
                      <p className="text-base font-medium">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-z-white/74">
                        {item.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </section>

        <section id="faq" className="mx-auto max-w-7xl px-6 py-20">
          <SectionHeading
            eyebrow="FAQ"
            title="Preguntas comunes antes de probarla."
            description="La idea es que la promesa sea clara desde la primera visita: menos ruido, más lectura útil de tu dinero."
          />

          <div className="mt-12 grid gap-4 lg:grid-cols-2">
            {faqs.map((faq) => (
              <Card
                key={faq.question}
                className="border-white/8 bg-white/[0.03] py-0 shadow-lg shadow-black/10"
              >
                <CardHeader className="gap-3 px-6 py-6">
                  <CardTitle className="text-xl">{faq.question}</CardTitle>
                  <CardDescription className="text-sm leading-6 text-muted-foreground">
                    {faq.answer}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative border-t border-white/6 bg-black/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BrandIcon className="size-8 rounded-2xl border border-white/10" />
            <p>Zeta. Finanzas personales con claridad diaria.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/login" className="transition-colors hover:text-foreground">
              Entrar
            </Link>
            <Link href="/signup" className="transition-colors hover:text-foreground">
              Crear cuenta
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
