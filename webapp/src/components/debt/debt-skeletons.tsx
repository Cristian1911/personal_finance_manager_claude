import { Card, CardContent } from "@/components/ui/card";

// ──────────────────────────────────────────────────────────────────────────────
// Content-shaped skeleton components for all tier 2 debt page sections.
// Rules:
//   • Mirror real component layout/height to prevent CLS
//   • Use animate-pulse + bg-muted for placeholder shapes
//   • No recharts imports, no "use client" directive
//   • Card/CardHeader/CardContent for structural wrapping (matching real cards)
// ──────────────────────────────────────────────────────────────────────────────

/** Hero section — mirrors 2/3 + 1/3 grid */
export function DebtOverviewSkeleton() {
  return (
    <Card className="rounded-2xl p-3">
      <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3">
        <div className="rounded-xl bg-muted/30 p-5">
          <div className="h-[60px] w-full rounded-md bg-muted animate-pulse" />
        </div>
        <div className="rounded-xl bg-muted/30 p-5">
          <div className="h-[60px] w-full rounded-md bg-muted animate-pulse" />
        </div>
      </div>
    </Card>
  );
}

/** Quick stats — mirrors 3-row categorized grid */
export function DebtQuickStatsSkeleton() {
  return (
    <Card className="rounded-2xl p-4">
      {[...Array(3)].map((_, row) => (
        <div key={row} className={row < 2 ? "mb-4" : ""}>
          <div className="h-3 w-24 rounded bg-muted animate-pulse mb-2 ml-1" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[...Array(3)].map((_, col) => (
              <div
                key={col}
                className="bg-[#0f0f11] border border-[#1f1f23] rounded-lg p-4"
              >
                <div className="h-3 w-16 rounded bg-muted animate-pulse mb-2" />
                <div className="h-6 w-24 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
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
