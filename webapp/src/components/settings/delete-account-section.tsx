"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAccount } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DESTRUCTIVE_BUTTON_CLASS,
  DESTRUCTIVE_GHOST_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  PANEL_SURFACE_SUBTLE_CLASS,
} from "@/lib/constants/styles";
import { cn } from "@/lib/utils";

const CONFIRMATION_PHRASE = "ELIMINAR";

export function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [isPending, startTransition] = useTransition();

  const canConfirm = confirmation.trim().toUpperCase() === CONFIRMATION_PHRASE;

  function handleDelete() {
    if (!canConfirm) return;
    startTransition(async () => {
      const result = await deleteAccount();
      // `deleteAccount` redirects on success — only reach here on error.
      if (result?.error) {
        toast.error(result.error);
      }
    });
  }

  return (
    <section
      className={cn(PANEL_SURFACE_SUBTLE_CLASS, "surface-debt p-4 sm:p-5")}
      aria-labelledby="delete-account-heading"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="space-y-1">
          <h2
            id="delete-account-heading"
            className="text-sm font-semibold text-z-debt"
          >
            Eliminar cuenta
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Borra tu cuenta y todos tus datos (transacciones, presupuestos,
            deudas, recurrentes, destinatarios, configuración). Esta acción es
            permanente y no se puede deshacer.
          </p>
        </div>

        <AlertDialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setConfirmation("");
          }}
        >
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              className={cn(DESTRUCTIVE_GHOST_BUTTON_CLASS, "shrink-0")}
            >
              <Trash2 className="size-4" aria-hidden />
              Eliminar cuenta
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar tu cuenta?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <span className="block">
                  Tu cuenta y todos los datos asociados se borrarán de forma
                  permanente. No podrás recuperarlos.
                </span>
                <span className="block">
                  Para confirmar, escribe{" "}
                  <span className="font-semibold text-foreground">
                    {CONFIRMATION_PHRASE}
                  </span>{" "}
                  abajo.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-2 pt-2">
              <Label htmlFor="delete-confirmation" className="text-xs">
                Confirmación
              </Label>
              <Input
                id="delete-confirmation"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder={CONFIRMATION_PHRASE}
                autoComplete="off"
                autoCapitalize="characters"
                disabled={isPending}
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel
                className={GHOST_BUTTON_CLASS}
                disabled={isPending}
              >
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                className={DESTRUCTIVE_BUTTON_CLASS}
                onClick={handleDelete}
                disabled={!canConfirm || isPending}
              >
                {isPending ? "Eliminando…" : "Eliminar cuenta"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}
