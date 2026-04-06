"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { autoAssignExpenses } from "@/actions/cashflow-planner";
import { toast } from "sonner";

interface AutoAssignButtonProps {
  periodId: string;
  disabled?: boolean;
}

export function AutoAssignButton({ periodId, disabled }: AutoAssignButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleAutoAssign() {
    startTransition(async () => {
      const result = await autoAssignExpenses(periodId);
      if (result.success) {
        if (result.data.assigned > 0) {
          toast.success(
            `${result.data.assigned} ${result.data.assigned === 1 ? "asignación creada" : "asignaciones creadas"}`
          );
        } else {
          toast.info("Todos los gastos ya están asignados");
        }
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleAutoAssign}
      disabled={disabled || isPending}
    >
      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
      {isPending ? "Asignando..." : "Auto-asignar"}
    </Button>
  );
}
