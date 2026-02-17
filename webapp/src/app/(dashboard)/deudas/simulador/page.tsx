import { getDebtOverview } from "@/actions/debt";
import { DebtSimulator } from "@/components/debt/debt-simulator";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function SimuladorPage() {
  const overview = await getDebtOverview();
  const activeDebts = overview.accounts.filter((a) => a.balance > 0);

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
            <h1 className="text-2xl font-bold">Simulador de Pago</h1>
            <p className="text-muted-foreground">
              Compara estrategias para pagar tus deudas más rápido
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground mb-2">
            No tienes deudas activas para simular.
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
          <h1 className="text-2xl font-bold">Simulador de Pago</h1>
          <p className="text-muted-foreground">
            Compara estrategias para pagar tus deudas más rápido
          </p>
        </div>
      </div>
      <DebtSimulator accounts={activeDebts} />
    </div>
  );
}
