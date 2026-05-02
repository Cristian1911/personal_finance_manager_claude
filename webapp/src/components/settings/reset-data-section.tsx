"use client";

import { useState, useTransition } from "react";
import { Eraser } from "lucide-react";
import { toast } from "sonner";
import { resetUserData } from "@/actions/auth";
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

const CONFIRMATION_PHRASE = "BORRAR";

export function ResetDataSection() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [isPending, startTransition] = useTransition();

  const canConfirm = confirmation.trim().toUpperCase() === CONFIRMATION_PHRASE;

  function handleReset() {
    if (!canConfirm) return;
    startTransition(async () => {
      const result = await resetUserData();
      // `resetUserData` redirects on success — only reach here on error.
      if (result?.error) {
        toast.error(result.error);
      }
    });
  }

  return (
    <section
      // Intentionally omits the `surface-debt` tint DeleteAccountSection
      // uses — reset is recoverable (account survives), delete is not.
      className={cn(PANEL_SURFACE_SUBTLE_CLASS, "p-4 sm:p-5")}
      aria-labelledby="reset-data-heading"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="space-y-1">
          <h2
            id="reset-data-heading"
            className="text-sm font-semibold text-foreground"
          >
            Borrar todos mis datos
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Elimina cuentas, transacciones, presupuestos, deudas, recurrentes
            y categorías personalizadas. Tu cuenta y tu sesión se mantienen:
            volverás al onboarding. Esta acción no se puede deshacer.
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
              <Eraser className="size-4" aria-hidden />
              Borrar mis datos
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Borrar todos tus datos?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <span className="block">
                  Se eliminarán cuentas, transacciones, presupuestos, deudas,
                  recurrentes, destinatarios y configuración. Tu cuenta y
                  correo se mantienen.
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
              <Label htmlFor="reset-confirmation" className="text-xs">
                Confirmación
              </Label>
              <Input
                id="reset-confirmation"
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
                onClick={handleReset}
                disabled={!canConfirm || isPending}
              >
                {isPending ? "Borrando…" : "Borrar todo"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}
