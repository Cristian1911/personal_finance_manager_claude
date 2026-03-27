import { Card, CardContent, CardHeader } from "@/components/ui/card";

// ──────────────────────────────────────────────────────────────────────────────
// Content-shaped skeleton components for all tier 2 debt page sections.
// Rules:
//   • Mirror real component layout/height to prevent CLS
//   • Use animate-pulse + bg-muted for placeholder shapes
//   • No recharts imports, no "use client" directive
//   • Card/CardHeader/CardContent for structural wrapping (matching real cards)
// ──────────────────────────────────────────────────────────────────────────────

/** Overview cards — mirrors 3-column grid: DebtHeroCard + UtilizationGauge + InterestCostCard */
export function DebtOverviewSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(3)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-5">
            <div className="h-[140px] w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Insights — mirrors DebtInsights: card with header title + 3 list rows (icon + text) */
export function DebtInsightsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-5 w-32 rounded-md bg-muted animate-pulse" />
      </CardHeader>
      <CardContent className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-4 w-4 rounded-md bg-muted animate-pulse shrink-0" />
            <div className="h-4 w-64 rounded-md bg-muted animate-pulse" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Salary bar — mirrors SalaryBar: card with label above + horizontal bar area */
export function SalaryBarSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="h-4 w-32 rounded-md bg-muted animate-pulse mb-3" />
        <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
      </CardContent>
    </Card>
  );
}

/** Per-account cards — mirrors section heading + 3-column grid of DebtAccountCard */
export function DebtAccountsSkeleton() {
  return (
    <div>
      <div className="h-5 w-40 rounded-md bg-muted animate-pulse mb-4" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <div className="h-[180px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
