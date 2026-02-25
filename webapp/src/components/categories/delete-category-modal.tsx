"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getCategoryTransactionCount, reassignAndDeleteCategory } from "@/actions/categories";
import type { CategoryWithBudget } from "@/types/domain";

interface DeleteCategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: CategoryWithBudget;
  /** All categories except the one being deleted, for reassignment dropdown */
  otherCategories: { id: string; name: string }[];
}

export function DeleteCategoryModal({
  open,
  onOpenChange,
  category,
  otherCategories,
}: DeleteCategoryModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [txCount, setTxCount] = useState<number | null>(null);
  const [reassignTo, setReassignTo] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  // Load transaction count when modal opens; reset state when it closes
  useEffect(() => {
    if (!open) {
      setStep(1);
      setReassignTo("");
      setTxCount(null);
      return;
    }
    let cancelled = false;
    getCategoryTransactionCount(category.id).then((res) => {
      if (cancelled) return;
      if (res.success) {
        setTxCount(res.data);
      } else {
        toast.error("No se pudo verificar las transacciones");
        setTxCount(0); // allow user to proceed or close
      }
    });
    return () => { cancelled = true; };
  }, [open, category.id]);

  function handleNext() {
    if (txCount !== null && txCount > 0 && !reassignTo) {
      toast.error("Selecciona una categoría de destino");
      return;
    }
    setStep(2);
  }

  function handleConfirm() {
    startTransition(async () => {
      const res = await reassignAndDeleteCategory(
        category.id,
        reassignTo || undefined
      );
      if (res.success) {
        toast.success(`"${category.name_es || category.name}" eliminada`);
        onOpenChange(false);
      } else {
        toast.error(res.error ?? "Error al eliminar");
      }
    });
  }

  const categoryDisplayName = category.name_es || category.name;
  const reassignTarget = otherCategories.find((c) => c.id === reassignTo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? `¿Eliminar "${categoryDisplayName}"?` : "Confirmar eliminación"}
          </DialogTitle>
          <DialogDescription>
            {step === 1 ? `Paso 1 de ${txCount ? 2 : 1}` : "Paso 2 de 2"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            {category.is_system && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Esta es una categoría del sistema. Eliminarla puede afectar a todos los usuarios.
                </span>
              </div>
            )}

            {txCount === null && (
              <p className="text-sm text-muted-foreground">Verificando transacciones...</p>
            )}

            {txCount !== null && txCount === 0 && (
              <p className="text-sm text-muted-foreground">
                Esta categoría no tiene transacciones asociadas.
              </p>
            )}

            {txCount !== null && txCount > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Esta categoría tiene <strong>{txCount} transacciones</strong> asociadas. Debes
                  reasignarlas antes de eliminar.
                </p>
                <div className="space-y-1.5">
                  <Label>Reasignar a:</Label>
                  <Select value={reassignTo} onValueChange={setReassignTo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar categoría..." />
                    </SelectTrigger>
                    <SelectContent>
                      {otherCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={txCount && txCount > 0 ? handleNext : handleConfirm}
                disabled={isPending || txCount === null || (txCount !== null && txCount > 0 && !reassignTo)}
              >
                {txCount !== null && txCount > 0 ? "Siguiente" : "Eliminar"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {reassignTarget
                ? `Se moverán ${txCount} transacciones a "${reassignTarget.name}" y se eliminará "${categoryDisplayName}".`
                : `Se eliminará "${categoryDisplayName}".`}
            </p>
            <p className="text-sm font-medium">Esta acción no se puede deshacer.</p>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)} disabled={isPending}>
                Atrás
              </Button>
              <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
                {isPending ? "Eliminando..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
