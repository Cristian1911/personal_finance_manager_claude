"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AmountInput } from "@/components/ui/amount-input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import { useAccounts } from "@/components/providers/app-data-provider";
import { recordRepayment } from "@/actions/personal-debts";

interface RecordRepaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personalDebtId: string;
  personName: string;
}

export function RecordRepaymentDialog({
  open,
  onOpenChange,
  personalDebtId,
  personName,
}: RecordRepaymentDialogProps) {
  const router = useRouter();
  const accounts = useAccounts();
  const today = format(new Date(), "yyyy-MM-dd");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    formData.set("account_id", accountId);
    formData.set("transaction_date", date);
    startTransition(async () => {
      const res = await recordRepayment(personalDebtId, formData);
      if (res.success) {
        toast.success("Abono registrado");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Error al registrar el abono");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar abono · {personName}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <AmountInput name="amount" autoFocus />
          <div className="space-y-2">
            <Label>Cuenta</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cuenta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Fecha</Label>
            <DatePicker value={date} onChange={(v) => setDate(v ?? today)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="repay-notes">Notas (opcional)</Label>
            <Input id="repay-notes" name="notes" placeholder="Detalle" />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              className={cn(BRASS_BUTTON_CLASS)}
              disabled={pending || !accountId}
            >
              {pending ? "Guardando..." : "Registrar abono"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
