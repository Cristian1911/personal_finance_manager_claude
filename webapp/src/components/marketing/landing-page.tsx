import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BanknoteArrowDown,
  BadgeDollarSign,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Landmark,
  PiggyBank,
  Repeat2,
  Scale,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
            <div className="flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-lg shadow-black/15">
              <Wallet className="size-5 text-z-sage-light" />
            </div>
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
                <h1 className="max-w-4xl text-5xl font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
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
          <p>Zeta. Finanzas personales con claridad diaria.</p>
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
