"use client";

import * as React from "react";
import { UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { DestinatarioPatternBuilder } from "@/components/destinatarios/destinatario-pattern-builder";
import { attachPatternToDestinatario } from "@/actions/destinatarios";
import { useDestinatarios } from "@/components/providers/app-data-provider";
import { useMediaQuery } from "@/hooks/use-media-query";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode } from "@/types/domain";

export interface AddDestinatarioPatternDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destinatarioId: string;
  destinatarioName: string;
  rawDescription?: string | null;
  merchantName?: string | null;
  amount?: number | null;
  currencyCode?: CurrencyCode | null;
  /** Called after one or more patterns are attached successfully. */
  onAdded?: () => void;
}

function AddPatternForm({
  destinatarioId,
  destinatarioName,
  rawDescription,
  merchantName,
  amount,
  currencyCode,
  onAdded,
  onCancel,
}: Omit<AddDestinatarioPatternDialogProps, "open" | "onOpenChange"> & {
  onCancel: () => void;
}) {
  const destinatarios = useDestinatarios();
  const [value, setValue] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function handleSubmit() {
    const list = value.split(",").map((p) => p.trim()).filter(Boolean);
    if (list.length === 0) {
      toast.error("Escribe o selecciona un patrón");
      return;
    }
    startTransition(async () => {
      let added = 0;
      const conflictNames = new Set<string>();
      let firstError: string | null = null;

      for (const pattern of list) {
        const result = await attachPatternToDestinatario(destinatarioId, pattern);
        if (result.success) {
          added++;
          for (const c of result.conflicts ?? []) {
            if (c.destinatarioId === destinatarioId) continue;
            const name = destinatarios.find((d) => d.id === c.destinatarioId)?.name;
            if (name) conflictNames.add(name);
          }
        } else if (!firstError) {
          firstError = result.error;
        }
      }

      if (added > 0) {
        toast.success(
          added === 1
            ? `Patrón agregado a ${destinatarioName}`
            : `${added} patrones agregados a ${destinatarioName}`,
        );
        if (conflictNames.size > 0) {
          toast.warning(
            `El patrón también coincide con: ${Array.from(conflictNames).join(", ")}`,
          );
        }
        onAdded?.();
      } else if (firstError) {
        toast.error(firstError);
      }
    });
  }

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="space-y-2">
        <Label>Nuevo patrón</Label>
        <DestinatarioPatternBuilder
          rawDescription={rawDescription}
          merchantName={merchantName}
          amount={amount}
          currencyCode={currencyCode}
          onValueChange={setValue}
          helpText={`Las transacciones que coincidan se asignarán a ${destinatarioName} automáticamente.`}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          className={GHOST_BUTTON_CLASS}
          onClick={onCancel}
          disabled={pending}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          className={BRASS_BUTTON_CLASS}
          onClick={handleSubmit}
          disabled={pending || !value.trim()}
        >
          {pending ? "Agregando…" : "Agregar patrón"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Adds one or more detection patterns to an already-assigned destinatario,
 * seeded from the originating transaction (same chip recognition as the
 * destinatario creation wizard). Responsive: Dialog on desktop, Drawer on mobile.
 */
export function AddDestinatarioPatternDialog({
  open,
  onOpenChange,
  ...formProps
}: AddDestinatarioPatternDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const title = "Agregar patrón";
  const description = `Reconoce esta transacción para ${formProps.destinatarioName}.`;

  const form = (
    <AddPatternForm
      {...formProps}
      onAdded={() => {
        formProps.onAdded?.();
        onOpenChange(false);
      }}
      onCancel={() => onOpenChange(false)}
    />
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserRound className="size-4 text-z-brass" />
              {title}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {form}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <UserRound className="size-4 text-z-brass" />
            {title}
          </DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <DrawerBody>{form}</DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
