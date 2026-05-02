"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { seedPeriodFromRecurring } from "@/actions/cashflow-planner";
import { Button } from "@/components/ui/button";
import { GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";

interface SyncRecurringButtonProps {
  periodId: string;
}

export function SyncRecurringButton({ periodId }: SyncRecurringButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await seedPeriodFromRecurring(periodId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const { created } = result.data;
      if (created === 0) {
        toast.info("Nada nuevo que sincronizar");
        return;
      }
      toast.success(
        `${created} ${created === 1 ? "recurrente agregado" : "recurrentes agregados"}`,
      );
    });
  }

  return (
    <Button
      size="sm"
      onClick={handleClick}
      disabled={isPending}
      aria-label="Sincronizar recurrentes"
      className={cn(GHOST_BUTTON_CLASS, "border")}
    >
      <RefreshCw className="h-3.5 w-3.5 sm:mr-1.5" />
      <span className="hidden sm:inline">
        {isPending ? "Sincronizando..." : "Sincronizar recurrentes"}
      </span>
    </Button>
  );
}
