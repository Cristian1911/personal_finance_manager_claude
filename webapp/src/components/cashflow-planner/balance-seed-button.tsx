"use client";

import { useTransition } from "react";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { upsertBalanceEnvelopes } from "@/actions/cashflow-planner";
import { Button } from "@/components/ui/button";

interface BalanceSeedButtonProps {
  periodId: string;
  hasExistingBalances: boolean;
}

export function BalanceSeedButton({
  periodId,
  hasExistingBalances,
}: BalanceSeedButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await upsertBalanceEnvelopes(periodId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const { created, updated } = result.data;
      if (created === 0 && updated === 0) {
        toast.info("No hay cuentas principales para cargar");
        return;
      }
      const parts: string[] = [];
      if (created > 0) parts.push(`${created} ${created === 1 ? "creado" : "creados"}`);
      if (updated > 0) parts.push(`${updated} ${updated === 1 ? "actualizado" : "actualizados"}`);
      toast.success(`Saldos: ${parts.join(" · ")}`);
    });
  }

  const idleLabel = hasExistingBalances ? "Actualizar saldos" : "Cargar saldos";
  const pendingLabel = hasExistingBalances ? "Actualizando..." : "Cargando...";

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
    >
      <Wallet className="mr-1.5 h-3.5 w-3.5" />
      {isPending ? pendingLabel : idleLabel}
    </Button>
  );
}
