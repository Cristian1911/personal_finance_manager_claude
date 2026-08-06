"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BRASS_BUTTON_CLASS,
  MOBILE_SHEET_SAFE_AREA_CLASS,
  PANEL_INSET_CLASS,
  SECTION_EYEBROW_CLASS,
} from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";
import { splitPersonalDebt } from "@/actions/personal-debts";
import {
  SplitParticipantsEditor,
  SplitPreview,
  newParticipantRow,
  toParticipantPayload,
  toSplitInput,
  validSplitParticipants,
  type SplitParticipantRow,
} from "./split-participants-editor";
import { computeSplit, getCurrencyDecimals, type SplitMethod } from "@zeta/shared";
import type { PersonalDebtWithDetails, CurrencyCode } from "@/types/domain";

interface SplitPersonalDebtSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debt: PersonalDebtWithDetails;
  currency: CurrencyCode;
}

/**
 * Break ONE lump "me deben" debt into a share per person — the case where you
 * paid a bill for a group and recorded it as a single debt before knowing how it
 * would be divided.
 *
 * The debt's principal is by definition what OTHERS owe, so there is no "yo
 * también participo" toggle here: the whole principal is divided among the
 * participants. Names can be typed straight in — they don't become contacts.
 */
export function SplitPersonalDebtSheet({
  open,
  onOpenChange,
  debt,
  currency,
}: SplitPersonalDebtSheetProps) {
  const router = useRouter();
  const code = (debt.currency_code ?? currency) as CurrencyCode;
  const decimals = getCurrencyDecimals(code);
  const principal = Number(debt.principal_amount);

  const [method, setMethod] = useState<SplitMethod>("equal");
  const [participants, setParticipants] = useState<SplitParticipantRow[]>([
    newParticipantRow(0),
    newParticipantRow(1),
  ]);
  const [pending, startTransition] = useTransition();

  const validParticipants = validSplitParticipants(participants);
  const preview =
    principal > 0 && validParticipants.length > 0
      ? computeSplit({
          total: principal,
          method,
          participants: toSplitInput(participants),
          userIncluded: false,
          decimals,
        })
      : null;

  const canSubmit = !pending && validParticipants.length >= 2 && preview?.ok === true;

  function handleSubmit() {
    if (!canSubmit) return;
    const fd = new FormData();
    fd.set("method", method);
    fd.set("participants", JSON.stringify(toParticipantPayload(participants)));

    startTransition(async () => {
      const res = await splitPersonalDebt(debt.id, fd);
      if (res.success) {
        onOpenChange(false);
        toast.success("Deuda dividida entre las personas");
        router.refresh();
      } else {
        toast.error(res.error ?? "Error al dividir la deuda");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn("max-h-[90dvh] overflow-y-auto", MOBILE_SHEET_SAFE_AREA_CLASS)}
      >
        <div className="mx-auto w-full max-w-md px-7">
          <SheetHeader className="px-0 pt-1">
            <SheetTitle>Dividir entre varias personas</SheetTitle>
          </SheetHeader>

          <div className="space-y-5 pb-4 pt-2">
            <div className={cn("p-4 text-center", PANEL_INSET_CLASS)}>
              <p className={SECTION_EYEBROW_CLASS}>Total a repartir</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-z-sage-light">
                {formatCurrency(principal, code)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {debt.destinatario_name}
              </p>
            </div>

            <SplitParticipantsEditor
              participants={participants}
              onChange={setParticipants}
              method={method}
              onMethodChange={setMethod}
              minRows={2}
            />

            <SplitPreview
              preview={preview}
              participants={validParticipants}
              currency={code}
              total={principal}
              userShareLabel={null}
            />

            <p className="text-xs text-muted-foreground">
              Esta deuda se reemplaza por una por persona, agrupadas en la pestaña
              Compartidas. Podrás registrar el pago de cada quien por separado.
            </p>

            <Button
              type="button"
              className={cn(BRASS_BUTTON_CLASS, "w-full")}
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              {pending ? "Dividiendo..." : "Dividir deuda"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
