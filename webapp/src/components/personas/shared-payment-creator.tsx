"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  DESTRUCTIVE_GHOST_BUTTON_CLASS,
  MOBILE_TAB_BAR_CLEARANCE_CLASS,
  PAGE_STACK_CLASS,
} from "@/lib/constants/styles";
import {
  SharedPaymentForm,
  type ExistingTransactionInput,
} from "@/components/personas/shared-payment-form";
import type { CurrencyCode } from "@/types/domain";

const BACK_HREF = "/deudas-personales";

/**
 * Client shell around the shared-payment creation form. Owns the exit guard so
 * a half-filled draft is never discarded silently: the header "Salir" prompts a
 * confirm when the form is dirty, and `beforeunload` covers reload / tab close.
 */
export function SharedPaymentCreator({
  currency,
  existingTransaction,
}: {
  currency: CurrencyCode;
  existingTransaction?: ExistingTransactionInput;
}) {
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Native guard for hard navigation (reload, tab close, external links).
  // In-app router navigation never fires beforeunload — the header "Salir"
  // interception below covers that path.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function leave() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(BACK_HREF);
    }
  }

  function handleBack() {
    if (dirty) {
      setConfirmOpen(true);
    } else {
      leave();
    }
  }

  return (
    <div className={PAGE_STACK_CLASS}>
      <MobileHeader
        variant="sub"
        title="Pago compartido"
        backHref={BACK_HREF}
        backStyle="exit"
        onBackClick={handleBack}
      />
      <div className={cn("px-4", MOBILE_TAB_BAR_CLEARANCE_CLASS)}>
        <SharedPaymentForm
          currency={currency}
          existingTransaction={existingTransaction}
          onDirtyChange={setDirty}
        />
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar este pago compartido?</AlertDialogTitle>
            <AlertDialogDescription>
              Aún no has guardado nada. Si sales ahora, se perderán el monto, las personas y
              el reparto que ingresaste.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction
              variant="ghost"
              className={cn(DESTRUCTIVE_GHOST_BUTTON_CLASS)}
              onClick={() => {
                setConfirmOpen(false);
                leave();
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
