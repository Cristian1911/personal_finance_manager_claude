"use client";

import { useState } from "react";
import { CalendarClock, Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import { LANDING_PLAN_DATA } from "./landing-data";

export function LandingPlan() {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const { income, committed, available, obligations } = LANDING_PLAN_DATA;

  const committedPct = Math.round((committed / income) * 100);
  const availablePct = Math.round((available / income) * 100);

  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
      {/* Heading */}
      <div className="mb-12 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-z-sage-light">
          Planificación mensual
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-z-white sm:text-4xl">
          ¿Cuánto margen te queda este mes?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
          Ve de un vistazo cuánto comprometiste y cuánto queda libre antes de
          que lleguen los próximos pagos.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Left card: flow bars */}
        <Card className="overflow-hidden border-white/8 bg-white/[0.03] py-0 shadow-2xl shadow-black/10">
          <CardContent className="px-6 py-6">
            <p className="mb-6 text-sm font-medium text-muted-foreground">
              Distribución de ingresos
            </p>

            {/* Income bar (full width) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Ingresos totales</span>
                <span className="font-medium text-z-white">{formatCurrency(income, "COP")}</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-white/8">
                <div className="h-full w-full rounded-full bg-z-income" />
              </div>
            </div>

            {/* Committed bar (proportional) */}
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Compromisos fijos</span>
                <span className="font-medium text-z-alert">
                  {formatCurrency(committed, "COP")}{" "}
                  <span className="text-muted-foreground">({committedPct}%)</span>
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-z-alert"
                  style={{ width: `${committedPct}%` }}
                />
              </div>
            </div>

            {/* Available balance highlight */}
            <div className="mt-8 rounded-2xl border border-z-income/20 bg-z-income/5 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-z-income/70">
                    Disponible
                  </p>
                  <p className="mt-1 text-3xl font-semibold text-z-income">
                    {formatCurrency(available, "COP")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {availablePct}% de los ingresos sin comprometer
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-z-income/30 bg-z-income/10 text-z-income"
                >
                  Libre
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right card: obligations list */}
        <Card className="overflow-hidden border-white/8 bg-white/[0.03] py-0 shadow-2xl shadow-black/10">
          <CardContent className="px-6 py-6">
            {/* Header */}
            <div className="mb-5 flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-xl border border-white/10 bg-black/20">
                <CalendarClock className="size-4 text-z-sage-light" />
              </div>
              <p className="text-sm font-medium text-z-white">
                Obligaciones del mes
              </p>
            </div>

            {/* Obligation items */}
            <ul className="space-y-2">
              {obligations.map((ob, idx) => (
                <li key={ob.name}>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedIdx(expandedIdx === idx ? null : idx)
                    }
                    className="w-full rounded-xl border border-white/6 bg-black/10 px-4 py-3 text-left transition-colors hover:border-white/12 hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center gap-3">
                      {/* Paid indicator */}
                      <span
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                          ob.paid
                            ? "border-z-income bg-z-income"
                            : "border-white/20 bg-transparent"
                        }`}
                      >
                        {ob.paid && <Check className="size-3 text-black" />}
                      </span>

                      {/* Name */}
                      <span
                        className={`flex-1 truncate text-sm font-medium ${
                          ob.paid ? "text-muted-foreground line-through" : "text-z-white"
                        }`}
                      >
                        {ob.name}
                      </span>

                      {/* Amount */}
                      <span
                        className={`shrink-0 text-sm font-medium ${
                          ob.paid ? "text-muted-foreground" : "text-z-white"
                        }`}
                      >
                        {formatCurrency(ob.amount, "COP")}
                      </span>
                    </div>

                    {/* Expanded: due date */}
                    {expandedIdx === idx && (
                      <div className="mt-2 flex items-center gap-1.5 pl-8">
                        <CalendarClock className="size-3 text-z-sage-light" />
                        <span className="text-[11px] text-z-sage-light">
                          Vence {ob.dueDate}
                        </span>
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
