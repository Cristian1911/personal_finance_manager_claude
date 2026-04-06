import Link from "next/link";
import { ChevronRight, PiggyBank, CalendarClock, Sparkles, Wallet } from "lucide-react";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";

const actions = [
  {
    href: "/plan/periodo",
    icon: Wallet,
    title: "Planear periodo",
    description: "Asigna cada gasto a un ingreso",
  },
  {
    href: "/categories",
    icon: PiggyBank,
    title: "Presupuesto",
    description: "Ajustar límites por categoría",
  },
  {
    href: "/recurrentes",
    icon: CalendarClock,
    title: "Ingresos y gastos",
    description: "Planear el flujo del mes",
  },
  {
    href: "/deudas/planificador",
    icon: Sparkles,
    title: "Escenarios",
    description: "Simular antes de decidir",
  },
] as const;

export function PlanActionCta() {
  return (
    <div className={`${PANEL_INSET_CLASS} overflow-hidden`}>
      <p className="px-3.5 pt-3 pb-1 text-[13px] font-semibold">Planificar</p>
      {actions.map((action, i) => (
        <Link
          key={action.href}
          href={action.href}
          className={`flex items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-white/[0.03] ${
            i < actions.length - 1 ? "border-b border-white/6" : ""
          }`}
        >
          <div className="flex items-center gap-3">
            <action.icon className="size-4 shrink-0 text-z-brass" />
            <div>
              <p className="text-[12px] font-semibold leading-tight">
                {action.title}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {action.description}
              </p>
            </div>
          </div>
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" />
        </Link>
      ))}
    </div>
  );
}
