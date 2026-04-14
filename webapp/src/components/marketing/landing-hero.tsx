import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import { LANDING_HERO_DATA } from "./landing-data";

// ─── Highlights ───────────────────────────────────────────────────────────────

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

// ─── HeroCard ─────────────────────────────────────────────────────────────────

function HeroCard() {
  const { availableToSpend, spentToday, dailyAllowance, monthMap } =
    LANDING_HERO_DATA;

  const spentPct = Math.round((spentToday / dailyAllowance) * 100);

  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-b from-primary/18 via-transparent to-z-income/10 blur-2xl" />
      <Card className="relative overflow-hidden rounded-[2rem] border-white/10 bg-[#111111]/90 py-0 shadow-2xl shadow-black/35">
        {/* Header */}
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

        {/* Available to spend */}
        <div className="px-6 py-6">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Disponible para gastar
          </p>
          <p className="mt-2 text-4xl font-semibold tracking-tight">
            {formatCurrency(availableToSpend, "COP")}
          </p>

          {/* Daily spending row */}
          <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Gasto hoy</span>
              <span>
                <span className="font-medium">
                  {formatCurrency(spentToday, "COP")}
                </span>
                <span className="ml-1 text-xs text-muted-foreground">
                  / {formatCurrency(dailyAllowance, "COP")}
                </span>
              </span>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-white/8">
              <div
                className="h-1.5 rounded-full bg-primary"
                style={{ width: `${Math.min(spentPct, 100)}%` }}
              />
            </div>
          </div>

          {/* Category bars */}
          <div className="mt-5 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">
              Mapa del mes
            </p>
            {monthMap.map((cat) => (
              <div key={cat.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{cat.label}</span>
                  <span className="tabular-nums">{cat.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/8">
                  <div
                    className={`h-1.5 rounded-full ${cat.color}`}
                    style={{ width: `${cat.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── MobileHeroStrip ─────────────────────────────────────────────────────────

function MobileHeroStrip() {
  const { availableToSpend, spentToday, dailyAllowance } = LANDING_HERO_DATA;
  const spentPct = Math.round((spentToday / dailyAllowance) * 100);

  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-2xl bg-gradient-to-b from-primary/14 via-transparent to-z-income/8 blur-2xl" />
      <Card className="relative overflow-hidden rounded-xl border-white/6 bg-z-ink/90 shadow-2xl shadow-black/35">
        {/* Available to spend */}
        <div className="px-5 pt-5 pb-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Disponible para gastar
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">
            {formatCurrency(availableToSpend, "COP")}
          </p>
        </div>

        {/* Daily spending row */}
        <div className="mx-5 mb-5 rounded-xl border border-white/6 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Gasto hoy</span>
            <span>
              <span className="font-medium">
                {formatCurrency(spentToday, "COP")}
              </span>
              <span className="ml-1 text-xs text-muted-foreground">
                / {formatCurrency(dailyAllowance, "COP")}
              </span>
            </span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-white/8">
            <div
              className="h-1.5 rounded-full bg-primary"
              style={{ width: `${Math.min(spentPct, 100)}%` }}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── LandingHero ─────────────────────────────────────────────────────────────

export function LandingHero() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-12 pt-12 sm:pb-20 sm:pt-24">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(24rem,0.9fr)] lg:items-center">
        {/* Left column — copy */}
        <div className="space-y-8">
          <p className="rounded-2xl bg-primary/14 px-4 py-2 text-xs font-medium leading-5 text-z-sage-light sm:rounded-full sm:w-fit">
            Zeta te ayuda a responder una sola pregunta: ¿vas bien o necesitas
            ajustar hoy?
          </p>

          <div className="space-y-6">
            <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-7xl">
              Claridad diaria sobre tu dinero.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
              Extractos, presupuesto, deudas y pagos recurrentes en una sola
              vista. Sin conectar tu banco. Hecho para Colombia.
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

          <div className="grid gap-4 md:grid-cols-3">
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

        {/* Right column — dashboard card (desktop) / strip (mobile) */}
        <div className="hidden lg:block">
          <HeroCard />
        </div>
        <div className="lg:hidden">
          <MobileHeroStrip />
        </div>
      </div>
    </section>
  );
}
