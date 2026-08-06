"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { ImagePlus } from "lucide-react";
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
import { ImageZoomPan } from "@/components/ui/image-zoom-pan";
import { cn } from "@/lib/utils";
import {
  BRASS_BUTTON_CLASS,
  BRASS_GHOST_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  ICON_DESTRUCTIVE_TRIGGER_CLASS,
  PANEL_INSET_CLASS,
  SECTION_EYEBROW_CLASS,
} from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";
import { useAccounts } from "@/components/providers/app-data-provider";
import { createSharedPayment } from "@/actions/shared-payments";
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
import type { CurrencyCode } from "@/types/domain";

export interface ExistingTransactionInput {
  id: string;
  amount: number;
  currencyCode: CurrencyCode;
  transactionDate: string; // yyyy-MM-dd
  description?: string | null;
}

interface SharedPaymentFormProps {
  currency: CurrencyCode;
  /** When provided, split an already-recorded transaction (existing mode). */
  existingTransaction?: ExistingTransactionInput;
  /** Reports whether the user has entered data worth an unsaved-changes guard. */
  onDirtyChange?: (dirty: boolean) => void;
}

const ACCEPTED_IMAGE = ["image/jpeg", "image/png", "image/webp"];
const MAX_INVOICE_BYTES = 8 * 1024 * 1024; // 8 MB — client-side reference only

export function SharedPaymentForm({
  currency,
  existingTransaction,
  onDirtyChange,
}: SharedPaymentFormProps) {
  const router = useRouter();
  const accounts = useAccounts();
  const today = format(new Date(), "yyyy-MM-dd");

  const isExisting = !!existingTransaction;
  const pageCurrency = existingTransaction?.currencyCode ?? currency;
  const decimals = getCurrencyDecimals(pageCurrency);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [total, setTotal] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [paidOn, setPaidOn] = useState(existingTransaction?.transactionDate ?? today);
  const [description, setDescription] = useState(existingTransaction?.description ?? "");
  const [method, setMethod] = useState<SplitMethod>("equal");
  const [userIncluded, setUserIncluded] = useState(true);
  const [participants, setParticipants] = useState<SplitParticipantRow[]>([
    newParticipantRow(0),
  ]);
  // Invoice is a CLIENT-SIDE reference only (v1): shown while filling values,
  // discarded on submit/leave. Nothing is uploaded. Object URL is revoked on
  // change/unmount to free memory.
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    return () => {
      if (invoiceUrl) URL.revokeObjectURL(invoiceUrl);
    };
  }, [invoiceUrl]);

  // Dirty = the user entered something that leaving would silently discard.
  // Bare toggles (método, "yo participo", fecha) don't count on their own.
  const initialDescription = existingTransaction?.description ?? "";
  const dirty =
    (!isExisting && total.trim() !== "") ||
    description !== initialDescription ||
    invoiceUrl !== null ||
    participants.some((p) => p.destinatarioId !== null || p.name.trim() !== "" || p.value.trim() !== "");

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const totalNum = isExisting ? existingTransaction!.amount : Number.parseFloat(total) || 0;
  const validParticipants = validSplitParticipants(participants);

  const preview =
    totalNum > 0 && validParticipants.length > 0
      ? computeSplit({
          total: totalNum,
          method,
          participants: toSplitInput(participants),
          userIncluded,
          decimals,
        })
      : null;

  const canSubmit =
    !pending &&
    totalNum > 0 &&
    validParticipants.length > 0 &&
    (isExisting || !!accountId) &&
    preview?.ok === true;

  function onPickInvoice(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    if (!ACCEPTED_IMAGE.includes(file.type)) {
      toast.error("La factura debe ser una imagen (JPG, PNG o WebP)");
      return;
    }
    if (file.size > MAX_INVOICE_BYTES) {
      toast.error("La imagen es muy grande (máx. 8 MB)");
      return;
    }
    setInvoiceUrl(URL.createObjectURL(file));
  }

  function removeInvoice() {
    setInvoiceUrl(null);
  }

  function handleSubmit() {
    if (!canSubmit || !preview?.ok) return;
    const fd = new FormData();
    fd.set("mode", isExisting ? "existing" : "new");
    fd.set("currency_code", pageCurrency);
    fd.set("method", method);
    fd.set("user_included", userIncluded ? "true" : "false");
    fd.set("paid_on", paidOn);
    fd.set("description", description);
    fd.set("participants", JSON.stringify(toParticipantPayload(participants)));
    if (isExisting) {
      fd.set("origin_transaction_id", existingTransaction!.id);
    } else {
      fd.set("account_id", accountId);
      fd.set("total_amount", String(totalNum));
    }

    startTransition(async () => {
      const res = await createSharedPayment(undefined, fd);
      if (res.success) {
        toast.success("Pago compartido creado");
        router.push("/deudas-personales");
        router.refresh();
      } else {
        toast.error(res.error ?? "Error al crear el pago compartido");
      }
    });
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onPickInvoice}
      />

      {/* Persistent invoice viewer — stays pinned below the header while the form
          scrolls, so the receipt stays in view as a reference. */}
      {invoiceUrl && (
        <div className="sticky top-12 z-[var(--z-layer-sticky)] -mx-4 border-b border-white/6 bg-z-surface px-4 py-2 lg:top-0">
          <div className="flex items-center justify-between pb-1.5">
            <p className={SECTION_EYEBROW_CLASS}>Factura (referencia)</p>
            <button
              type="button"
              onClick={removeInvoice}
              className={cn(ICON_DESTRUCTIVE_TRIGGER_CLASS, "text-xs")}
            >
              Quitar
            </button>
          </div>
          <ImageZoomPan
            src={invoiceUrl}
            alt="Factura"
            className="h-52 rounded-xl border border-white/6 bg-black/30"
          />
        </div>
      )}

      <div className="space-y-5 pt-4">
        {!invoiceUrl && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            className={cn(BRASS_GHOST_BUTTON_CLASS, "w-full")}
          >
            <ImagePlus className="mr-1.5 size-4" />
            Adjuntar factura (referencia)
          </Button>
        )}

        {/* Total + cuenta */}
        {isExisting ? (
          <div className={cn("p-4 text-center", PANEL_INSET_CLASS)}>
            <p className={SECTION_EYEBROW_CLASS}>Total del pago</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-z-sage-light">
              {formatCurrency(totalNum, pageCurrency)}
            </p>
          </div>
        ) : (
          <>
            <AmountInput
              currency={pageCurrency}
              value={total}
              onChange={(e) => setTotal(e.target.value)}
            />
            <div className="space-y-2">
              <Label>Cuenta del pago</Label>
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
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Fecha</Label>
            <DatePicker value={paidOn} onChange={(v) => setPaidOn(v ?? today)} className="w-full" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="split-desc">Descripción</Label>
            <Input
              id="split-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej. Cena restaurante"
            />
          </div>
        </div>

        {/* Yo participo */}
        <button
          type="button"
          onClick={() => setUserIncluded((v) => !v)}
          className={cn(
            "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-colors",
            userIncluded ? BRASS_GHOST_BUTTON_CLASS : GHOST_BUTTON_CLASS,
          )}
        >
          <span>Yo también participo</span>
          <span className="text-xs text-muted-foreground">{userIncluded ? "Sí" : "No"}</span>
        </button>

        <SplitParticipantsEditor
          participants={participants}
          onChange={setParticipants}
          method={method}
          onMethodChange={setMethod}
        />

        <SplitPreview
          preview={preview}
          participants={validParticipants}
          currency={pageCurrency}
          total={totalNum}
          userShareLabel={userIncluded ? "Tu parte" : null}
        />

        <Button
          type="button"
          className={cn(BRASS_BUTTON_CLASS, "w-full")}
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {pending ? "Guardando..." : "Crear pago compartido"}
        </Button>
      </div>
    </div>
  );
}
