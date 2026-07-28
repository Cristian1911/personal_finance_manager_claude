"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { EntityRow } from "@/components/ui/entity-row";
import { AccountIcon } from "@/components/accounts/account-icon";
import { DetailCell } from "@/components/mobile/v2/deudas/detail-cell";
import { archiveDebtObligation } from "@/actions/accounts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deriveAccountRow } from "@/lib/utils/entity-row-model";
import { formatCurrency } from "@/lib/utils/currency";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/domain";

/**
 * Adaptador entre `Account` y la primitiva de fila. Aquí viven las acciones
 * propias de /accounts; la primitiva no sabe nada de cuentas.
 */
export function AccountEntityRow({
  account,
  today,
  defaultOpen = false,
  open,
  onOpenChange,
}: {
  account: Account;
  /** Día actual en YYYY-MM-DD, calculado en el servidor. Leer el reloj en un
   *  componente cliente durante el render rompe la hidratación. */
  today: string;
  /** Nace expandida. Lo usa ?saldadas=1 para dejar el archivado a la vista. */
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const model = deriveAccountRow(account, { today });
  const router = useRouter();
  const [selfOpen, setSelfOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleArchive() {
    startTransition(async () => {
      const result = await archiveDebtObligation(account.id);
      if (result.success) {
        setConfirmOpen(false);
        // La acción revalida las etiquetas del servidor, pero esta página ya
        // está montada: sin refresh la fila archivada sigue en pantalla.
        router.refresh();
        toast.success(`${account.name} archivada`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
    <EntityRow
      leading={
        <span className="flex size-9 items-center justify-center rounded-lg border border-white/6 bg-white/[0.04]">
          <AccountIcon
            bank_key={account.bank_key}
            account_type={account.account_type}
            color={account.color}
            size="md"
          />
        </span>
      }
      title={account.name}
      gauge={model.gauge}
      meta={model.meta}
      trailing={model.trailing}
      open={isControlled ? open : selfOpen}
      onOpenChange={isControlled ? onOpenChange : setSelfOpen}
    >
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <DetailCell
            label={model.trailing.caption}
            tone={model.trailing.tone === "neutral" ? undefined : model.trailing.tone}
          >
            {model.trailing.value}
          </DetailCell>
          <DetailCell label="Cupo">
            {account.credit_limit != null
              ? formatCurrency(account.credit_limit, account.currency_code)
              : "—"}
          </DetailCell>
        </div>

        {/* Una obligación en cero no necesita abono, necesita cerrarse. Antes
            esto vivía en el menú "···" de /accounts/[id]: cinco pasos. */}
        {model.primaryAction === "archive" && (
          <Button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className={cn(BRASS_BUTTON_CLASS, "w-full")}
          >
            <Archive className="size-4" aria-hidden />
            Archivar (pagada)
          </Button>
        )}

        <Link
          href={`/accounts/${account.id}`}
          className={cn(
            GHOST_BUTTON_CLASS,
            "flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm",
          )}
        >
          Ver detalle
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </EntityRow>

    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archivar obligación</DialogTitle>
          <DialogDescription>
            {account.name} queda archivada y sus pagos recurrentes se
            desactivan. Podrás verla en las obligaciones cerradas de Deudas.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setConfirmOpen(false)}
            disabled={pending}
            className={GHOST_BUTTON_CLASS}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleArchive}
            disabled={pending}
            className={BRASS_BUTTON_CLASS}
          >
            {pending ? "Archivando..." : "Archivar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
