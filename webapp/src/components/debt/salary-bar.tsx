import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@zeta/shared";
import type { MonthlyBreakdown } from "@zeta/shared";

interface Props {
  breakdown: MonthlyBreakdown;
  currency: CurrencyCode;
}

export function SalaryBar({ breakdown, currency }: Props) {
  const { income, segments, freePercentage } = breakdown;
  const debtSegments = segments.filter((s) => s.accountId !== "libre");
  const libreSegment = segments.find((s) => s.accountId === "libre");

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Tu salario hoy</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {formatCurrency(income, currency)}
            </span>
            <span
              className="text-lg font-bold"
              style={{ color: libreSegment?.color ?? "#22c55e" }}
            >
              {freePercentage.toFixed(0)}% libre
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stacked horizontal bar */}
        <div className="flex h-10 w-full overflow-hidden rounded-lg">
          {segments.map((seg) => (
            <div
              key={seg.accountId}
              className="flex items-center justify-center overflow-hidden transition-all"
              style={{
                width: `${Math.max(seg.percentage, 1)}%`,
                backgroundColor: seg.color,
              }}
            >
              {seg.percentage > 12 && (
                <span className="text-[11px] font-medium text-white truncate px-1">
                  {seg.name}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {segments.map((seg) => (
            <div
              key={seg.accountId}
              className="flex items-center gap-1.5 text-xs"
            >
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              <span className="text-muted-foreground">{seg.name}</span>
              <span className="font-medium">
                {formatCurrency(seg.amount, currency)}
              </span>
            </div>
          ))}
        </div>

        {/* CTA */}
        {debtSegments.length > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
            <p className="text-sm text-muted-foreground">
              ¿Quieres ver cómo crece lo libre mes a mes?
            </p>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/deudas/planificador">
                Simular
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
