"use client";

import dynamic from "next/dynamic";

const MobileMovimientos = dynamic(() => import("./mobile-movimientos").then(m => ({ default: m.MobileMovimientos })));
const MobilePresupuesto = dynamic(() => import("./mobile-presupuesto").then(m => ({ default: m.MobilePresupuesto })));
const MobileDebtRecurrentes = dynamic(() => import("./mobile-debt-recurrentes").then(m => ({ default: m.MobileDebtRecurrentes })));
const MobileMovimientosPresupuesto = dynamic(() => import("./mobile-movimientos-presupuesto").then(m => ({ default: m.MobileMovimientosPresupuesto })));
const MobilePresupuestoAhorro = dynamic(() => import("./mobile-presupuesto-ahorro").then(m => ({ default: m.MobilePresupuestoAhorro })));

function featureKey(features: string[]): string {
  return [...features].sort().join("+");
}

interface TabViewRouterProps {
  features: string[];
  data: Record<string, unknown>;
}

export function TabViewRouter({ features, data }: TabViewRouterProps) {
  const key = featureKey(features);

  switch (key) {
    case "debt+recurring":
      return <MobileDebtRecurrentes {...(data as any)} />;
    case "transactions":
      return <MobileMovimientos {...(data as any)} />;
    case "budget":
      return <MobilePresupuesto {...(data as any)} />;
    case "budget+transactions":
      return <MobileMovimientosPresupuesto {...(data as any)} />;
    case "budget+savings":
      return <MobilePresupuestoAhorro {...(data as any)} />;
    default:
      return <MobileMovimientos {...(data as any)} />;
  }
}
