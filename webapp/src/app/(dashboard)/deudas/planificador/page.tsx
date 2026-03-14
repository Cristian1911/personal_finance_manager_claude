import { getDebtOverview } from "@/actions/debt";
import { getPreferredCurrency } from "@/actions/profile";
import { getScenarios } from "@/actions/scenarios";
import { ScenarioPlanner } from "@/components/debt/scenario-planner";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function PlanificadorPage() {
  const currency = await getPreferredCurrency();
  const overview = await getDebtOverview(currency);
  const activeDebts = overview.accounts.filter((a) => a.balance > 0);
  const savedScenarios = await getScenarios();

  if (activeDebts.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/deudas">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Planificador de Pagos</h1>
            <p className="text-muted-foreground">
              Crea planes para pagar tus deudas más rápido
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground mb-2">
            No tienes deudas activas para planificar.
          </p>
          <Link href="/deudas" className="text-primary hover:underline text-sm">
            Volver a Deudas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/deudas">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Planificador de Pagos</h1>
          <p className="text-muted-foreground">
            Crea planes para pagar tus deudas más rápido
          </p>
        </div>
      </div>
      <ScenarioPlanner
        accounts={activeDebts}
        currency={currency}
        savedScenarios={savedScenarios}
      />
    </div>
  );
}
