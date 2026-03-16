"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils/currency";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
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
  const totalDebtAmount = debtSegments.reduce((s, d) => s + d.amount, 0);
  const [openPopover, setOpenPopover] = useState<string | null>(null);

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
        <TooltipProvider>
          <div className="flex h-10 w-full overflow-hidden rounded-lg">
            {segments.map((seg) => (
              <Popover
                key={seg.accountId}
                open={openPopover === seg.accountId}
                onOpenChange={(open) =>
                  setOpenPopover(open ? seg.accountId : null)
                }
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center justify-center overflow-hidden transition-all cursor-pointer hover:brightness-110 hover:scale-y-105 origin-bottom"
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
                      </button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {seg.name} · {seg.percentage.toFixed(1)}%
                  </TooltipContent>
                </Tooltip>
                <PopoverContent
                  side="top"
                  align="center"
                  className="w-auto min-w-[180px] p-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className="font-medium text-sm">{seg.name}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatCurrency(seg.amount, currency)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {seg.percentage.toFixed(1)}% de tu ingreso
                    </div>
                    {seg.accountId !== "libre" && debtSegments.length > 1 && totalDebtAmount > 0 && (
                      <div className="text-xs text-muted-foreground border-t pt-1.5 mt-1">
                        {((seg.amount / totalDebtAmount) * 100).toFixed(0)}% del total de deudas
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            ))}
          </div>
        </TooltipProvider>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {segments.map((seg) => (
            <button
              key={seg.accountId}
              type="button"
              className="flex items-center gap-1.5 text-xs cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() =>
                setOpenPopover(
                  openPopover === seg.accountId ? null : seg.accountId
                )
              }
            >
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              <span className="text-muted-foreground">{seg.name}</span>
              <span className="font-medium">
                {formatCurrency(seg.amount, currency)}
              </span>
            </button>
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
