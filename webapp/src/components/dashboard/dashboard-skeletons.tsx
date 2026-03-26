import { Card, CardContent, CardHeader } from "@/components/ui/card";

// ──────────────────────────────────────────────────────────────────────────────
// Content-shaped skeleton components for all tier 2 dashboard sections.
// Rules:
//   • Mirror real component layout/height to prevent CLS
//   • Use animate-pulse + bg-muted for placeholder shapes
//   • No recharts imports, no "use client" directive
//   • Card/CardHeader/CardContent for structural wrapping (matching real cards)
// ──────────────────────────────────────────────────────────────────────────────

/** Ritmo de gasto — area chart with header + legend */
export function BurnRateSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        {/* Header row: label + toggle */}
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 w-28 rounded-md bg-muted animate-pulse" />
          <div className="h-7 w-32 rounded-md bg-muted animate-pulse" />
        </div>
        {/* Headline */}
        <div className="h-8 w-24 rounded-md bg-muted animate-pulse mb-1" />
        {/* Subtitle */}
        <div className="h-4 w-56 rounded-md bg-muted animate-pulse mb-4" />
        {/* Chart area */}
        <div className="h-[120px] w-full rounded-md bg-muted animate-pulse" />
      </CardContent>
    </Card>
  );
}

/** Mis cuentas — list rows with icon + name + sparkline + balance */
export function AccountsSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="h-5 w-36 rounded-md bg-muted animate-pulse" />
        <div className="h-4 w-16 rounded-md bg-muted animate-pulse" />
      </CardHeader>
      <CardContent className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <div className="h-2 w-2 rounded-full bg-muted animate-pulse shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-32 rounded-md bg-muted animate-pulse" />
              <div className="h-3 w-20 rounded-md bg-muted animate-pulse" />
            </div>
            <div className="h-8 w-16 rounded-md bg-muted animate-pulse" />
            <div className="h-8 w-24 rounded-md bg-muted animate-pulse" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Flujo de caja — waterfall chart */
export function FlujoWaterfallSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-5 w-40 rounded-md bg-muted animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="h-[320px] w-full rounded-md bg-muted animate-pulse" />
      </CardContent>
    </Card>
  );
}

/** Flujo de caja — line/bar charts with tab toggle */
export function FlujoChartsSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="h-5 w-36 rounded-md bg-muted animate-pulse" />
        <div className="flex gap-1">
          <div className="h-7 w-16 rounded-md bg-muted animate-pulse" />
          <div className="h-7 w-16 rounded-md bg-muted animate-pulse" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full rounded-md bg-muted animate-pulse" />
      </CardContent>
    </Card>
  );
}

/** Presupuesto 50/30/20 — two-card grid: donut + pace chart */
export function PresupuestoSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="h-5 w-40 rounded-md bg-muted animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full rounded-md bg-muted animate-pulse" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="h-5 w-36 rounded-md bg-muted animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="h-[240px] w-full rounded-md bg-muted animate-pulse" />
        </CardContent>
      </Card>
    </div>
  );
}

/** Patrimonio y deuda — two-card grid: net worth history + debt breakdown */
export function PatrimonioSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="h-5 w-48 rounded-md bg-muted animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full rounded-md bg-muted animate-pulse" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="h-5 w-40 rounded-md bg-muted animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="h-[240px] w-full rounded-md bg-muted animate-pulse" />
        </CardContent>
      </Card>
    </div>
  );
}

/** Actividad — spending heatmap */
export function HeatmapSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-5 w-44 rounded-md bg-muted animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="h-[160px] w-full rounded-md bg-muted animate-pulse" />
      </CardContent>
    </Card>
  );
}

/** Próximos pagos — list rows with icon + name + amount + date */
export function UpcomingPaymentsSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="h-5 w-40 rounded-md bg-muted animate-pulse" />
        <div className="h-4 w-16 rounded-md bg-muted animate-pulse" />
      </CardHeader>
      <CardContent className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-4 w-4 rounded-md bg-muted animate-pulse shrink-0" />
            <div className="h-4 w-40 rounded-md bg-muted animate-pulse flex-1" />
            <div className="h-4 w-16 rounded-md bg-muted animate-pulse ml-auto" />
            <div className="h-4 w-12 rounded-md bg-muted animate-pulse" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** CashFlowHeroStrip — full-width horizontal bar */
export function CashFlowHeroStripSkeleton() {
  return (
    <div className="h-10 w-full rounded-xl bg-muted animate-pulse" />
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Mobile-specific skeletons (simpler, card-height matched)
// ──────────────────────────────────────────────────────────────────────────────

/** Mobile — Ritmo de gasto */
export function MobileBurnRateSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="h-4 w-28 rounded-md bg-muted animate-pulse mb-3" />
        <div className="h-8 w-24 rounded-md bg-muted animate-pulse mb-2" />
        <div className="h-[120px] w-full rounded-md bg-muted animate-pulse" />
      </CardContent>
    </Card>
  );
}

/** Mobile — Presupuesto 50/30/20 allocation bars */
export function MobileAllocationSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="h-4 w-24 rounded-md bg-muted animate-pulse mb-3" />
        <div className="space-y-3">
          <div className="h-8 w-full rounded-md bg-muted animate-pulse" />
          <div className="h-8 w-full rounded-md bg-muted animate-pulse" />
          <div className="h-8 w-full rounded-md bg-muted animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}

/** Mobile — Deuda countdown */
export function MobileDebtSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="h-4 w-20 rounded-md bg-muted animate-pulse mb-3" />
        <div className="h-8 w-32 rounded-md bg-muted animate-pulse mb-2" />
        <div className="h-[100px] w-full rounded-md bg-muted animate-pulse" />
      </CardContent>
    </Card>
  );
}
