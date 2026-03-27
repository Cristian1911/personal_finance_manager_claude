"use client";

import dynamic from "next/dynamic";
import type { MobileDebtRecurrentesProps } from "./mobile-debt-recurrentes";
import type { MobileMovimientosProps } from "./mobile-movimientos";
import type { MobilePresupuestoProps } from "./mobile-presupuesto";
import type { MobileMovimientosPresupuestoProps } from "./mobile-movimientos-presupuesto";
import type { MobilePresupuestoAhorroProps } from "./mobile-presupuesto-ahorro";

const MobileMovimientos = dynamic(() => import("./mobile-movimientos").then(m => ({ default: m.MobileMovimientos })));
const MobilePresupuesto = dynamic(() => import("./mobile-presupuesto").then(m => ({ default: m.MobilePresupuesto })));
const MobileDebtRecurrentes = dynamic(() => import("./mobile-debt-recurrentes").then(m => ({ default: m.MobileDebtRecurrentes })));
const MobileMovimientosPresupuesto = dynamic(() => import("./mobile-movimientos-presupuesto").then(m => ({ default: m.MobileMovimientosPresupuesto })));
const MobilePresupuestoAhorro = dynamic(() => import("./mobile-presupuesto-ahorro").then(m => ({ default: m.MobilePresupuestoAhorro })));

type TabViewData =
  | MobileDebtRecurrentesProps
  | MobileMovimientosProps
  | MobilePresupuestoProps
  | MobileMovimientosPresupuestoProps
  | MobilePresupuestoAhorroProps;

function featureKey(features: string[]): string {
  return [...features].sort().join("+");
}

interface TabViewRouterProps {
  features: string[];
  data: TabViewData;
}

export function TabViewRouter({ features, data }: TabViewRouterProps) {
  const key = featureKey(features);

  switch (key) {
    case "debt+recurring": {
      const props = data as MobileDebtRecurrentesProps;
      return <MobileDebtRecurrentes {...props} />;
    }
    case "transactions": {
      const props = data as MobileMovimientosProps;
      return <MobileMovimientos {...props} />;
    }
    case "budget": {
      const props = data as MobilePresupuestoProps;
      return <MobilePresupuesto {...props} />;
    }
    case "budget+transactions": {
      const props = data as MobileMovimientosPresupuestoProps;
      return <MobileMovimientosPresupuesto {...props} />;
    }
    case "budget+savings": {
      const props = data as MobilePresupuestoAhorroProps;
      return <MobilePresupuestoAhorro {...props} />;
    }
    default: {
      const props = data as MobileMovimientosProps;
      return <MobileMovimientos {...props} />;
    }
  }
}
