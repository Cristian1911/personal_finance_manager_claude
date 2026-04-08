# Landing Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the 1,561-line landing page monolith into focused components with interactive real UI (mock data), mobile hamburger nav, swipeable showcase carousel, and fixed CTA copy.

**Architecture:** Split `landing-page.tsx` into 10 focused files under `webapp/src/components/marketing/`. Three sections become interactive client components with hardcoded mock data. The showcase section becomes placeholder cards (screenshot-ready). Mobile gets a hamburger drawer nav and a CSS scroll-snap carousel with phone frames.

**Tech Stack:** Next.js 15, Tailwind v4, shadcn/ui (Card, Badge, Button, Drawer), lucide-react, CSS scroll-snap. No new dependencies.

---

### Task 1: Create mock data constants

**Files:**
- Create: `webapp/src/components/marketing/landing-data.ts`

- [ ] **Step 1: Create the mock data file with all constants**

```typescript
// webapp/src/components/marketing/landing-data.ts
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeDollarSign,
  CalendarClock,
  CreditCard,
  FileUp,
  Landmark,
  PiggyBank,
  Repeat2,
  Scale,
  Search,
  Send,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

// ─── Hero ────────────────────────────────────────────────────────────────────

export const LANDING_HERO_DATA = {
  availableToSpend: 3_420_000,
  spentToday: 45_000,
  dailyAllowance: 180_000,
  currency: "COP" as const,
  monthMap: [
    { label: "Hogar", pct: 84, color: "bg-emerald-500" },
    { label: "Alimentación", pct: 62, color: "bg-amber-500" },
    { label: "Transporte", pct: 48, color: "bg-sky-500" },
    { label: "Salud", pct: 30, color: "bg-violet-400" },
    { label: "Estilo de vida", pct: 75, color: "bg-orange-400" },
    { label: "Obligaciones", pct: 92, color: "bg-red-400" },
  ],
};

// ─── Budget ──────────────────────────────────────────────────────────────────

export const LANDING_BUDGET_DATA = [
  { name: "Hogar", spent: 1_848_000, budget: 2_200_000, color: "#5CB88A", icon: "🏠" },
  { name: "Alimentación", spent: 496_000, budget: 800_000, color: "#D4A843", icon: "🛒" },
  { name: "Transporte", spent: 120_000, budget: 250_000, color: "#38BDF8", icon: "🚗" },
  { name: "Salud", spent: 90_000, budget: 300_000, color: "#A78BFA", icon: "🏥" },
  { name: "Estilo de vida", spent: 450_000, budget: 600_000, color: "#E8875A", icon: "🎭" },
  { name: "Obligaciones", spent: 1_104_000, budget: 1_200_000, color: "#E05545", icon: "📋" },
];

// ─── Monthly Plan ────────────────────────────────────────────────────────────

export const LANDING_PLAN_DATA = {
  income: 10_400_000,
  committed: 7_200_000,
  available: 3_200_000,
  currency: "COP" as const,
  obligations: [
    { name: "Arriendo", amount: 1_850_000, dueDate: "01 May", paid: false },
    { name: "Servicios públicos", amount: 185_000, dueDate: "05 May", paid: false },
    { name: "Tarjeta crédito", amount: 780_000, dueDate: "12 May", paid: false },
    { name: "Crédito vehículo", amount: 680_000, dueDate: "25 May", paid: false },
  ],
};

// ─── Showcase Panels ─────────────────────────────────────────────────────────

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
    description: "PDF a movimientos organizados en minutos",
    icon: FileUp,
    gradient: "from-amber-500/20 to-amber-900/5",
  },
  {
    id: "accounts",
    title: "Cuentas y balances",
    description: "Multi-moneda, multi-banco, una sola vista",
    icon: Wallet,
    gradient: "from-emerald-500/20 to-emerald-900/5",
  },
  {
    id: "destinatarios",
    title: "Destinatarios",
    description: "Reglas de reconocimiento automático de comercios",
    icon: Users,
    gradient: "from-violet-500/20 to-violet-900/5",
  },
  {
    id: "debt",
    title: "Estrategia de deuda",
    description: "Avalancha, bola de nieve o balanceado — tú decides",
    icon: Scale,
    gradient: "from-red-500/20 to-red-900/5",
  },
  {
    id: "recurring",
    title: "Pagos recurrentes",
    description: "Próximos pagos visibles antes de que sean problema",
    icon: Repeat2,
    gradient: "from-sky-500/20 to-sky-900/5",
  },
  {
    id: "capture",
    title: "Captura rápida",
    description: "Registra gastos con texto natural",
    icon: Send,
    gradient: "from-orange-500/20 to-orange-900/5",
  },
];

// ─── Features (unchanged from current landing) ──────────────────────────────

export type Feature = {
  title: string;
  description: string;
  icon: LucideIcon;
  bullets: string[];
  accentClassName: string;
};

export const LANDING_FEATURES: Feature[] = [
  {
    title: "Dashboard que responde qué hacer hoy",
    description: "Zeta te muestra si vas bien, dónde se va la presión y qué vale la pena ajustar primero.",
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
    description: "Subes tus extractos y Zeta organiza movimientos, detecta cuentas y ayuda a conciliar duplicados.",
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
    description: "No solo registra gastos: te muestra cuánto margen te queda y qué categoría está rompiendo el plan.",
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
    description: "Modela pagos y entiende qué decisión libera presión antes. Ideal para tarjetas, cuotas y metas de salida.",
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
    description: "Si manejas COP, USD u otras monedas, puedes ver saldos y movimientos sin forzar una sola realidad.",
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
    description: "Pagos por venir, reglas de destinatarios y bandejas para que lo repetitivo no te robe energía mental.",
    icon: Repeat2,
    bullets: [
      "Pagos próximos visibles antes de que se vuelvan problema",
      "Reglas para reconocer mejor movimientos frecuentes",
      "Flujos de gestión pensados para mantener el sistema limpio",
    ],
    accentClassName: "from-violet-300/20 via-violet-300/8 to-transparent",
  },
];

// ─── Workflow Steps ──────────────────────────────────────────────────────────

export const LANDING_WORKFLOW = [
  {
    step: "01",
    title: "Sube tus extractos o crea tus cuentas",
    description: "Empiezas rápido con PDF o con carga manual. La idea es que el primer mapa financiero aparezca pronto.",
  },
  {
    step: "02",
    title: "Zeta organiza, agrupa y te muestra presión real",
    description: "Movimientos, presupuesto, deuda y recurrentes empiezan a hablar entre sí para mostrarte el estado del mes.",
  },
  {
    step: "03",
    title: "Decides con claridad diaria",
    description: "No necesitas adivinar qué corregir. El sistema te deja ver prioridades, riesgos y siguientes pasos.",
  },
];

// ─── FAQs ────────────────────────────────────────────────────────────────────

export const LANDING_FAQS = [
  {
    question: "¿Zeta necesita conexión directa con mi banco?",
    answer: "No. El flujo principal está pensado alrededor de extractos PDF y registro controlado dentro de la app.",
  },
  {
    question: "¿Sirve si manejo varias cuentas o varias monedas?",
    answer: "Sí. La app contempla cuentas multi-moneda y te ayuda a no mezclar realidades distintas en un solo saldo.",
  },
  {
    question: "¿Es solo para registrar gastos?",
    answer: "No. La propuesta es ayudarte a decidir: presupuesto, deudas, pagos recurrentes, categorías y claridad diaria.",
  },
  {
    question: "¿Está pensada para Colombia?",
    answer: "Sí. El lenguaje, el enfoque y la importación por extractos están diseñados alrededor del uso financiero local.",
  },
];

// ─── Supported Institutions ─────────────────────────────────────────────────

export const LANDING_INSTITUTIONS = [
  "Bancolombia", "Banco de Bogotá", "Davivienda", "Nu", "Falabella",
  "Nequi", "Popular", "Lulo", "Confiar",
];

// ─── Nav Links ───────────────────────────────────────────────────────────────

export const LANDING_NAV_LINKS = [
  { href: "#showcase", label: "Showcase" },
  { href: "#funciones", label: "Funciones" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#colombia", label: "Colombia" },
  { href: "#faq", label: "FAQ" },
];
```

- [ ] **Step 2: Verify no type errors**

Run: `cd webapp && npx tsc --noEmit --pretty 2>&1 | grep landing-data`
Expected: no errors (file has no imports from app internals)

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/marketing/landing-data.ts
git commit -m "feat(landing): add mock data constants for redesigned landing page"
```

---

### Task 2: Create the phone frame component

**Files:**
- Create: `webapp/src/components/marketing/phone-frame.tsx`

- [ ] **Step 1: Create the phone frame component**

```tsx
// webapp/src/components/marketing/phone-frame.tsx
import type { ReactNode } from "react";

interface PhoneFrameProps {
  children: ReactNode;
  className?: string;
}

export function PhoneFrame({ children, className }: PhoneFrameProps) {
  return (
    <div className={`mx-auto w-[280px] shrink-0 ${className ?? ""}`}>
      <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-z-ink shadow-2xl shadow-black/30">
        {/* Notch */}
        <div className="flex justify-center py-2">
          <div className="h-[5px] w-20 rounded-full bg-white/10" />
        </div>
        {/* Screen */}
        <div className="px-1 pb-2">
          <div className="overflow-hidden rounded-[1.25rem] bg-background">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/components/marketing/phone-frame.tsx
git commit -m "feat(landing): add PhoneFrame component for mobile showcase"
```

---

### Task 3: Create the landing header with mobile hamburger

**Files:**
- Create: `webapp/src/components/marketing/landing-header.tsx`

- [ ] **Step 1: Create the header component**

```tsx
// webapp/src/components/marketing/landing-header.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandIcon } from "@/components/app/brand-icon";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { LANDING_NAV_LINKS } from "./landing-data";

export function LandingHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <header className="relative border-b border-white/6 bg-background/70 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <BrandIcon
            className="size-10 rounded-2xl border border-white/10 shadow-lg shadow-black/15"
            priority
          />
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-z-sage-light">
              Zeta
            </p>
            <p className="text-xs text-muted-foreground">
              Finanzas personales con claridad diaria
            </p>
          </div>
        </div>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          {LANDING_NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop buttons + mobile hamburger */}
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href="/login">Entrar</Link>
          </Button>
          <Button
            asChild
            className="hidden rounded-full bg-primary px-5 text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 sm:inline-flex"
          >
            <Link href="/signup">Crear cuenta</Link>
          </Button>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-muted-foreground transition-colors hover:bg-white/[0.06] md:hidden"
            aria-label="Abrir menú"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-left">Menú</DrawerTitle>
          </DrawerHeader>
          <nav className="flex flex-col gap-1 px-4 pb-6">
            {LANDING_NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-white/5"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-4 flex flex-col gap-2">
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">Entrar</Link>
              </Button>
              <Button asChild className="w-full bg-primary text-primary-foreground">
                <Link href="/signup">Crear cuenta</Link>
              </Button>
            </div>
          </nav>
        </DrawerContent>
      </Drawer>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/components/marketing/landing-header.tsx
git commit -m "feat(landing): add LandingHeader with mobile hamburger drawer"
```

---

### Task 4: Create the interactive hero section

**Files:**
- Create: `webapp/src/components/marketing/landing-hero.tsx`

- [ ] **Step 1: Create the hero component with interactive card**

The hero keeps the current copy/layout but replaces the hardcoded mock dashboard card with a `LandingHeroCard` sub-component using data from `landing-data.ts`. The card shows available to spend, daily spending vs allowance, and 6 category progress bars.

```tsx
// webapp/src/components/marketing/landing-hero.tsx
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LANDING_HERO_DATA } from "./landing-data";

const highlights = [
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

function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}

function HeroCard() {
  const d = LANDING_HERO_DATA;
  const spentPct = Math.round((d.spentToday / d.dailyAllowance) * 100);

  return (
    <Card className="border-white/8 bg-white/[0.03] shadow-2xl shadow-black/20">
      <CardHeader className="pb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Vista de claridad diaria
        </p>
        <CardTitle className="text-3xl font-semibold tabular-nums tracking-tight">
          {formatCOP(d.availableToSpend)}
        </CardTitle>
        <p className="text-xs text-muted-foreground">Disponible para gastar</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Daily spending vs allowance */}
        <div className="flex items-center justify-between rounded-xl border border-white/6 bg-black/12 px-4 py-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Gasto hoy</p>
            <p className="text-lg font-semibold tabular-nums">{formatCOP(d.spentToday)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Asignación</p>
            <p className="text-lg font-semibold tabular-nums text-muted-foreground">{formatCOP(d.dailyAllowance)}</p>
          </div>
        </div>

        {/* Month map */}
        <div className="space-y-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Mapa del mes
          </p>
          {d.monthMap.map((cat) => (
            <div key={cat.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{cat.label}</span>
                <span className="tabular-nums">{cat.pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/8">
                <div
                  className={`h-2 rounded-full ${cat.color} transition-all`}
                  style={{ width: `${cat.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function LandingHero() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-20 pt-16 sm:pt-24">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(24rem,0.9fr)] lg:items-center">
        {/* Left — copy */}
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
            <Button asChild size="lg" className="rounded-full bg-primary px-7 text-primary-foreground shadow-lg shadow-primary/20">
              <Link href="/signup">
                Quiero probar Zeta
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full border-white/10 bg-white/4 px-7 text-foreground hover:bg-white/8">
              <a href="#funciones">Ver todo lo que hace</a>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {highlights.map((h) => (
              <div key={h.label} className="rounded-3xl border border-white/8 bg-white/[0.03] p-5 shadow-lg shadow-black/10">
                <p className="text-sm font-semibold text-z-sage-light">{h.value}</p>
                <p className="mt-1 text-xs font-medium text-foreground/80">{h.label}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{h.detail}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right — interactive card */}
        <HeroCard />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/components/marketing/landing-hero.tsx
git commit -m "feat(landing): add LandingHero with interactive dashboard card"
```

---

### Task 5: Create the interactive budget section

**Files:**
- Create: `webapp/src/components/marketing/landing-budget.tsx`

- [ ] **Step 1: Create the budget visualization**

```tsx
// webapp/src/components/marketing/landing-budget.tsx
"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LANDING_BUDGET_DATA } from "./landing-data";

function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}

export function LandingBudgetSection() {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const totalBudget = LANDING_BUDGET_DATA.reduce((s, c) => s + c.budget, 0);
  const totalSpent = LANDING_BUDGET_DATA.reduce((s, c) => s + c.spent, 0);
  const overallPct = Math.round((totalSpent / totalBudget) * 100);

  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <div className="max-w-3xl space-y-4">
        <Badge variant="outline" className="border-white/10 bg-white/4 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-z-sage-light">
          Presupuesto
        </Badge>
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          ¿En qué se va tu dinero?
        </h2>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          Visualiza tu gasto por categoría y detecta dónde ajustar antes de que el mes termine.
        </p>
      </div>

      <Card className="mt-8 border-white/8 bg-white/[0.03] shadow-2xl shadow-black/10">
        <CardContent className="p-6">
          {/* Overall progress */}
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Gastado del presupuesto</p>
              <p className="text-2xl font-semibold tabular-nums">{formatCOP(totalSpent)} <span className="text-base text-muted-foreground">/ {formatCOP(totalBudget)}</span></p>
            </div>
            <p className={`text-lg font-semibold tabular-nums ${overallPct > 85 ? "text-z-debt" : overallPct > 70 ? "text-z-alert" : "text-z-income"}`}>
              {overallPct}%
            </p>
          </div>

          {/* Category bars */}
          <div className="space-y-4">
            {LANDING_BUDGET_DATA.map((cat, i) => {
              const pct = Math.round((cat.spent / cat.budget) * 100);
              const isHovered = hoveredIdx === i;
              return (
                <div
                  key={cat.name}
                  className="group cursor-default"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onTouchStart={() => setHoveredIdx(i === hoveredIdx ? null : i)}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span>{cat.icon}</span>
                      <span className="text-foreground/90">{cat.name}</span>
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {isHovered ? `${formatCOP(cat.spent)} / ${formatCOP(cat.budget)}` : `${pct}%`}
                    </span>
                  </div>
                  <div className="mt-1.5 h-3 rounded-full bg-white/8">
                    <div
                      className="h-3 rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: cat.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/components/marketing/landing-budget.tsx
git commit -m "feat(landing): add interactive budget section with hover tooltips"
```

---

### Task 6: Create the interactive monthly planning section

**Files:**
- Create: `webapp/src/components/marketing/landing-plan.tsx`

- [ ] **Step 1: Create the plan visualization**

```tsx
// webapp/src/components/marketing/landing-plan.tsx
"use client";

import { useState } from "react";
import { CalendarClock, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LANDING_PLAN_DATA } from "./landing-data";

function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}

export function LandingPlanSection() {
  const d = LANDING_PLAN_DATA;
  const committedPct = Math.round((d.committed / d.income) * 100);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <div className="max-w-3xl space-y-4">
        <Badge variant="outline" className="border-white/10 bg-white/4 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-z-sage-light">
          Planificación mensual
        </Badge>
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          ¿Cuánto margen te queda este mes?
        </h2>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          Ingresos, compromisos y lo que realmente queda para decidir.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Flow bars */}
        <Card className="border-white/8 bg-white/[0.03] shadow-2xl shadow-black/10">
          <CardContent className="space-y-6 p-6">
            {/* Income */}
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Ingresos</span>
                <span className="font-semibold tabular-nums text-z-income">{formatCOP(d.income)}</span>
              </div>
              <div className="mt-2 h-4 rounded-full bg-z-income/20">
                <div className="h-4 w-full rounded-full bg-z-income" />
              </div>
            </div>

            {/* Committed */}
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Comprometido</span>
                <span className="font-semibold tabular-nums text-z-alert">{formatCOP(d.committed)}</span>
              </div>
              <div className="mt-2 h-4 rounded-full bg-white/8">
                <div className="h-4 rounded-full bg-z-alert" style={{ width: `${committedPct}%` }} />
              </div>
            </div>

            {/* Available */}
            <div className="rounded-xl border border-z-income/20 bg-z-income/5 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Disponible real</span>
                <span className="text-xl font-semibold tabular-nums text-z-income">{formatCOP(d.available)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Obligations list */}
        <Card className="border-white/8 bg-white/[0.03] shadow-2xl shadow-black/10">
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarClock className="size-4" />
              <span>Próximos compromisos</span>
            </div>
            <div className="space-y-2">
              {d.obligations.map((ob, i) => (
                <button
                  key={ob.name}
                  type="button"
                  onClick={() => setExpandedIdx(i === expandedIdx ? null : i)}
                  className="flex w-full items-center justify-between rounded-xl border border-white/6 bg-black/12 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex size-6 items-center justify-center rounded-full border ${ob.paid ? "border-z-income/30 bg-z-income/10" : "border-white/10 bg-white/[0.03]"}`}>
                      {ob.paid && <Check className="size-3 text-z-income" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{ob.name}</p>
                      {expandedIdx === i && (
                        <p className="mt-0.5 text-xs text-muted-foreground">Vence {ob.dueDate}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{formatCOP(ob.amount)}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/components/marketing/landing-plan.tsx
git commit -m "feat(landing): add interactive monthly planning section"
```

---

### Task 7: Create the showcase section with carousel

**Files:**
- Create: `webapp/src/components/marketing/landing-showcase.tsx`

- [ ] **Step 1: Create the showcase with desktop grid + mobile carousel**

```tsx
// webapp/src/components/marketing/landing-showcase.tsx
"use client";

import { useRef, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PhoneFrame } from "./phone-frame";
import { LANDING_SHOWCASE_PANELS, type ShowcasePanel } from "./landing-data";

function ShowcasePlaceholder({ panel }: { panel: ShowcasePanel }) {
  const Icon = panel.icon;
  return (
    <div className={`flex flex-col items-center justify-center rounded-xl bg-gradient-to-br ${panel.gradient} p-8`}>
      <div className="flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
        <Icon className="size-8 text-white/60" />
      </div>
      <p className="mt-4 text-sm text-white/40">Vista previa próximamente</p>
    </div>
  );
}

function ShowcaseCard({ panel }: { panel: ShowcasePanel }) {
  const Icon = panel.icon;
  return (
    <Card className="overflow-hidden border-white/8 bg-white/[0.03] shadow-2xl shadow-black/10">
      <CardHeader className="gap-3 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-black/20">
            <Icon className="size-4 text-z-sage-light" />
          </div>
          <div>
            <CardTitle className="text-lg">{panel.title}</CardTitle>
            <CardDescription className="text-xs">{panel.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <div className="aspect-video overflow-hidden rounded-xl">
          <ShowcasePlaceholder panel={panel} />
        </div>
      </CardContent>
    </Card>
  );
}

export function LandingShowcase() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const scrollLeft = el.scrollLeft;
      const cardWidth = 280 + 16; // card width + gap
      setActiveIdx(Math.round(scrollLeft / cardWidth));
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section id="showcase" className="mx-auto max-w-7xl px-6 py-16">
      <div className="max-w-3xl space-y-4">
        <Badge variant="outline" className="border-white/10 bg-white/4 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-z-sage-light">
          Showcase
        </Badge>
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Todo lo que necesitas, en un solo lugar
        </h2>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          Importación, cuentas, destinatarios, deuda, recurrentes y captura — cada funcionalidad pensada para que el día a día financiero sea más claro.
        </p>
      </div>

      {/* Desktop: 2-column grid */}
      <div className="mt-8 hidden gap-6 lg:grid lg:grid-cols-2">
        {LANDING_SHOWCASE_PANELS.map((panel) => (
          <ShowcaseCard key={panel.id} panel={panel} />
        ))}
      </div>

      {/* Mobile: horizontal carousel with phone frames */}
      <div className="mt-8 lg:hidden">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-none"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {LANDING_SHOWCASE_PANELS.map((panel) => (
            <div key={panel.id} className="snap-center shrink-0" style={{ scrollSnapAlign: "center" }}>
              <PhoneFrame>
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <panel.icon className="size-4 text-z-sage-light" />
                    <p className="text-xs font-semibold text-foreground">{panel.title}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-4">{panel.description}</p>
                  <div className="aspect-[9/14] overflow-hidden rounded-lg">
                    <ShowcasePlaceholder panel={panel} />
                  </div>
                </div>
              </PhoneFrame>
            </div>
          ))}
        </div>

        {/* Dot indicators */}
        <div className="mt-3 flex justify-center gap-1.5">
          {LANDING_SHOWCASE_PANELS.map((panel, i) => (
            <div
              key={panel.id}
              className={`h-1.5 rounded-full transition-all ${i === activeIdx ? "w-4 bg-z-brass" : "w-1.5 bg-white/20"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webapp/src/components/marketing/landing-showcase.tsx
git commit -m "feat(landing): add showcase section with desktop grid + mobile carousel"
```

---

### Task 8: Extract features, CTA, and remaining sections

**Files:**
- Create: `webapp/src/components/marketing/landing-features.tsx`
- Create: `webapp/src/components/marketing/landing-cta.tsx`

- [ ] **Step 1: Create the features section**

Extract `SectionHeading`, `FeatureCard`, features grid, para quién, Colombia, cómo funciona, and FAQ into one file. These sections are server-renderable (no state), so no `"use client"`.

```tsx
// webapp/src/components/marketing/landing-features.tsx
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LANDING_FEATURES,
  LANDING_WORKFLOW,
  LANDING_FAQS,
  LANDING_INSTITUTIONS,
  type Feature,
} from "./landing-data";

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="max-w-3xl space-y-4">
      <Badge variant="outline" className="border-white/10 bg-white/4 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-z-sage-light">
        {eyebrow}
      </Badge>
      <div className="space-y-3">
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">{description}</p>
      </div>
    </div>
  );
}

function FeatureCard({ title, description, icon: Icon, bullets, accentClassName }: Feature) {
  return (
    <Card className="relative overflow-hidden border-white/8 bg-white/[0.03] py-0 shadow-2xl shadow-black/10">
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b ${accentClassName}`} />
      <CardHeader className="relative gap-4 px-6 pt-6">
        <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
          <Icon className="size-5 text-z-sage-light" />
        </div>
        <div className="space-y-2">
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription className="text-sm leading-6 text-muted-foreground">{description}</CardDescription>
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

export function LandingFeatures() {
  return (
    <section id="funciones" className="mx-auto max-w-7xl px-6 py-20">
      <SectionHeading
        eyebrow="Lo que hace"
        title="Herramientas diseñadas para decisiones, no para contabilidad"
        description="Zeta combina las funciones que un colombiano necesita para manejar sus finanzas con claridad y sin hojas de cálculo."
      />
      <div className="mt-10 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {LANDING_FEATURES.map((f) => <FeatureCard key={f.title} {...f} />)}
      </div>
    </section>
  );
}

export function LandingAudience() {
  const profiles = [
    { title: "Profesional independiente", desc: "Freelancer o empleado que maneja más de un ingreso y quiere ver todo en un solo lugar." },
    { title: "Pareja que comparte gastos", desc: "Necesitan una vista honesta del gasto compartido y las deudas conjuntas." },
    { title: "Persona saliendo de deudas", desc: "Busca una estrategia clara para reducir presión sin perder visibilidad." },
    { title: "Primero organizando finanzas", desc: "No tiene sistema aún, quiere empezar con algo claro y progresivo." },
  ];

  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-white/8 bg-white/[0.03] shadow-2xl shadow-black/10">
          <CardHeader>
            <CardTitle className="text-2xl">Para quién encaja</CardTitle>
            <CardDescription>Personas que quieren control sin convertirse en contadores.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {profiles.map((p) => (
                <div key={p.title} className="rounded-2xl border border-white/6 bg-black/12 p-4">
                  <p className="text-sm font-semibold">{p.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{p.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card id="colombia" className="border-white/8 bg-white/[0.03] shadow-2xl shadow-black/10">
          <CardHeader>
            <CardTitle className="text-2xl">Hecho para Colombia</CardTitle>
            <CardDescription>Importación directa desde extractos PDF de bancos y billeteras locales.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {LANDING_INSTITUTIONS.map((name) => (
                <Badge key={name} variant="outline" className="border-white/10 bg-white/4 text-xs">
                  {name}
                </Badge>
              ))}
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              No necesitas dar credenciales. Bajas el extracto PDF, lo subes, y Zeta organiza todo.
              Si tu banco no está soportado, lo agregamos rápido.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

export function LandingHowItWorks() {
  return (
    <section id="como-funciona" className="mx-auto max-w-7xl px-6 py-20">
      <SectionHeading
        eyebrow="Cómo funciona"
        title="Tres pasos para ver tu situación con claridad"
        description="No necesitas contabilidad ni configuración compleja — sube un extracto y deja que el sistema te muestre la historia."
      />
      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {LANDING_WORKFLOW.map((w) => (
          <Card key={w.step} className="border-white/8 bg-white/[0.03] shadow-2xl shadow-black/10">
            <CardHeader>
              <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-lg font-semibold text-z-sage-light">
                {w.step}
              </div>
              <CardTitle className="mt-4 text-xl">{w.title}</CardTitle>
              <CardDescription className="text-sm leading-6 text-muted-foreground">{w.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function LandingFAQ() {
  return (
    <section id="faq" className="mx-auto max-w-7xl px-6 py-20">
      <SectionHeading
        eyebrow="FAQ"
        title="Preguntas frecuentes"
        description="Dudas comunes antes de empezar."
      />
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {LANDING_FAQS.map((faq) => (
          <Card key={faq.question} className="border-white/8 bg-white/[0.03] shadow-2xl shadow-black/10">
            <CardHeader>
              <CardTitle className="text-base">{faq.question}</CardTitle>
              <CardDescription className="text-sm leading-6">{faq.answer}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create the CTA section with fixed copy**

```tsx
// webapp/src/components/marketing/landing-cta.tsx
import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles, Target, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const blurbs = [
  { icon: Sparkles, title: "Mensaje claro", desc: "Cada pantalla responde una pregunta sobre tu dinero." },
  { icon: ShieldCheck, title: "Sin credenciales", desc: "Tus datos bancarios nunca salen de tu banco. Solo PDF." },
  { icon: Target, title: "Hecho para Colombia", desc: "Bancos locales, moneda local, contexto local." },
  { icon: TrendingUp, title: "Escalable", desc: "Multi-moneda, multi-cuenta, multi-deuda. Crece contigo." },
];

export function LandingCTA() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <Card className="overflow-hidden border-white/8 bg-gradient-to-br from-white/[0.06] via-background to-z-income/[0.04] shadow-2xl shadow-black/10">
        <CardContent className="grid gap-10 p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-12">
          <div className="space-y-6">
            <Badge className="rounded-full bg-primary/14 px-4 py-1.5 text-xs font-medium text-z-sage-light">
              Empieza hoy
            </Badge>
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Toma el control de tus finanzas
            </h2>
            <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Zeta te da claridad diaria sobre tu dinero — sin conectar bancos, sin compartir credenciales.
              Importa tus extractos PDF y empieza a planificar en minutos.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Button asChild size="lg" className="rounded-full bg-primary px-7 text-primary-foreground shadow-lg shadow-primary/20">
                <Link href="/signup">
                  Crear cuenta gratis
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full border-white/10 bg-white/4 px-7 text-foreground hover:bg-white/8">
                <a href="#como-funciona">Ver cómo funciona</a>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {blurbs.map((b) => (
              <div key={b.title} className="rounded-2xl border border-white/6 bg-black/12 p-4">
                <b.icon className="size-5 text-z-sage-light" />
                <p className="mt-2 text-sm font-semibold">{b.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{b.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/marketing/landing-features.tsx webapp/src/components/marketing/landing-cta.tsx
git commit -m "feat(landing): extract features, audience, how-it-works, FAQ, and CTA sections"
```

---

### Task 9: Rewrite landing-page.tsx as thin compositor + footer

**Files:**
- Modify: `webapp/src/components/marketing/landing-page.tsx` (full rewrite)

- [ ] **Step 1: Rewrite as compositor importing all sections**

Replace the entire 1,561-line file with a thin compositor. The footer stays inline since it's small.

```tsx
// webapp/src/components/marketing/landing-page.tsx
import Link from "next/link";
import { BrandIcon } from "@/components/app/brand-icon";
import { LandingHeader } from "./landing-header";
import { LandingHero } from "./landing-hero";
import { LandingBudgetSection } from "./landing-budget";
import { LandingPlanSection } from "./landing-plan";
import { LandingShowcase } from "./landing-showcase";
import {
  LandingFeatures,
  LandingAudience,
  LandingHowItWorks,
  LandingFAQ,
} from "./landing-features";
import { LandingCTA } from "./landing-cta";

export function MarketingLandingPage() {
  return (
    <div className="relative overflow-hidden bg-background text-foreground">
      {/* Ambient gradients */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(197,191,174,0.14),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(82,183,136,0.14),transparent_22%),radial-gradient(circle_at_50%_65%,rgba(244,162,97,0.12),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-[-18rem] h-[32rem] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(197,191,174,0.16),transparent,rgba(233,196,106,0.12),transparent,rgba(82,183,136,0.1),transparent)] blur-3xl" />

      <LandingHeader />

      <main className="relative">
        <LandingHero />
        <LandingBudgetSection />
        <LandingPlanSection />
        <LandingShowcase />
        <LandingFeatures />
        <LandingAudience />
        <LandingHowItWorks />
        <LandingCTA />
        <LandingFAQ />
      </main>

      {/* Footer */}
      <footer className="relative border-t border-white/6">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BrandIcon className="size-8 rounded-xl border border-white/10 shadow-lg shadow-black/15" />
            <p className="text-xs text-muted-foreground">Finanzas personales con claridad diaria</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-muted-foreground transition-colors hover:text-foreground">Entrar</Link>
            <Link href="/signup" className="text-z-brass transition-colors hover:text-z-brass/80">Crear cuenta</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd webapp && pnpm build 2>&1 | tail -5`
Expected: clean build with no errors

- [ ] **Step 3: Commit**

```bash
git add webapp/src/components/marketing/landing-page.tsx
git commit -m "refactor(landing): rewrite as thin compositor importing section components"
```

---

### Task 10: Final verification and cleanup

- [ ] **Step 1: Run full build**

Run: `cd webapp && pnpm build`
Expected: clean build, no type errors, no missing imports

- [ ] **Step 2: Check for leftover unused files**

The old `landing-page.tsx` is now rewritten. Verify no orphaned imports or dead code:

Run: `grep -r "MockShell\|MockMetric\|MockProgress\|ShowcasePanel\|showcaseImportSteps\|showcaseAccounts\|showcaseRecipients\|showcaseRecurringItems\|showcaseDebtPlans\|showcaseQuickCaptureMessages" webapp/src/ --include="*.tsx" --include="*.ts" -l`
Expected: no files (all old constructs removed)

- [ ] **Step 3: Verify the page route still works**

Run: `grep -n "MarketingLandingPage" webapp/src/app/page.tsx`
Expected: the import and usage are intact (we didn't change `page.tsx`)

- [ ] **Step 4: Final commit if any cleanup was needed**

```bash
git add -A
git commit -m "chore(landing): cleanup dead code from landing page monolith"
```
