"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EntityRow } from "@/components/ui/entity-row";
import { AccountIcon } from "@/components/accounts/account-icon";
import { DetailCell } from "@/components/mobile/v2/deudas/detail-cell";
import { deriveAccountRow } from "@/lib/utils/entity-row-model";
import { formatCurrency } from "@/lib/utils/currency";
import { GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/domain";

/**
 * Adaptador entre `Account` y la primitiva de fila. Aquí viven las acciones
 * propias de /accounts; la primitiva no sabe nada de cuentas.
 */
export function AccountEntityRow({
  account,
  today,
  open,
  onOpenChange,
}: {
  account: Account;
  /** Día actual en YYYY-MM-DD, calculado en el servidor. Leer el reloj en un
   *  componente cliente durante el render rompe la hidratación. */
  today: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const model = deriveAccountRow(account, { today });

  return (
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
      open={open}
      onOpenChange={onOpenChange}
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
  );
}
