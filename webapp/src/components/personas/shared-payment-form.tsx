"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, X, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AmountInput } from "@/components/ui/amount-input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DestinatarioZonePicker } from "@/components/destinatarios/destinatario-zone-picker";
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

interface ParticipantRow {
  key: number;
  destinatarioId: string | null;
  name: string | null;
  value: string;
}

const METHOD_LABELS: { value: SplitMethod; label: string }[] = [
  { value: "equal", label: "Iguales" },
  { value: "amount", label: "Montos" },
  { value: "percent", label: "%" },
];

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

  const keyRef = useRef(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [total, setTotal] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [paidOn, setPaidOn] = useState(existingTransaction?.transactionDate ?? today);
  const [description, setDescription] = useState(existingTransaction?.description ?? "");
  const [method, setMethod] = useState<SplitMethod>("equal");
  const [userIncluded, setUserIncluded] = useState(true);
  const [participants, setParticipants] = useState<ParticipantRow[]>([
    { key: 0, destinatarioId: null, name: null, value: "" },
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
    participants.some((p) => p.destinatarioId !== null || p.value.trim() !== "");

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const totalNum = isExisting ? existingTransaction!.amount : Number.parseFloat(total) || 0;
  const validParticipants = participants.filter((p) => p.destinatarioId);

  const preview =
    totalNum > 0 && validParticipants.length > 0
      ? computeSplit({
          total: totalNum,
          method,
          participants: validParticipants.map((p) => ({
            destinatario_id: p.destinatarioId!,
            value: p.value === "" ? undefined : Number.parseFloat(p.value),
          })),
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

  function addParticipant() {
    setParticipants((prev) => [
      ...prev,
      { key: keyRef.current++, destinatarioId: null, name: null, value: "" },
    ]);
  }

  function removeParticipant(key: number) {
    setParticipants((prev) => (prev.length === 1 ? prev : prev.filter((p) => p.key !== key)));
  }

  function updateParticipant(key: number, patch: Partial<ParticipantRow>) {
    setParticipants((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
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
    fd.set(
      "participants",
      JSON.stringify(
        validParticipants.map((p) => ({
          destinatario_id: p.destinatarioId,
          value: p.value === "" ? undefined : Number.parseFloat(p.value),
        })),
      ),
    );
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

        {/* Método de reparto */}
        <div className="space-y-2">
          <Label>Tipo de reparto</Label>
          <div className="grid grid-cols-3 gap-2">
            {METHOD_LABELS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMethod(m.value)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  method === m.value ? BRASS_GHOST_BUTTON_CLASS : GHOST_BUTTON_CLASS,
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Participantes */}
        <div className="space-y-3">
          <Label>Personas</Label>
          {participants.map((p) => (
            <div key={p.key} className="flex items-start gap-2">
              <div className="flex-1">
                <DestinatarioZonePicker
                  value={p.destinatarioId}
                  onValueChange={(id, name) => updateParticipant(p.key, { destinatarioId: id, name })}
                  selectedName={p.name}
                  placeholder="Elegir o crear persona"
                  triggerClassName="w-full"
                  kindFilter={["person"]}
                  createKind="person"
                  variant="dialog"
                />
              </div>
              {method === "amount" && (
                <CurrencyInput
                  inputMode="numeric"
                  value={p.value}
                  onChange={(e) => updateParticipant(p.key, { value: e.target.value })}
                  placeholder="$"
                  className="w-28 shrink-0 text-right tabular-nums"
                />
              )}
              {method === "percent" && (
                <div className="relative w-20 shrink-0">
                  <Input
                    inputMode="decimal"
                    value={p.value}
                    onChange={(e) => updateParticipant(p.key, { value: e.target.value })}
                    placeholder="0"
                    className="pr-6 text-right tabular-nums"
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    %
                  </span>
                </div>
              )}
              {participants.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeParticipant(p.key)}
                  aria-label="Quitar persona"
                  className={cn(ICON_DESTRUCTIVE_TRIGGER_CLASS, "mt-1 shrink-0 p-1.5")}
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            onClick={addParticipant}
            className={cn(GHOST_BUTTON_CLASS, "w-full")}
          >
            <Plus className="mr-1.5 size-4" />
            Agregar persona
          </Button>
        </div>

        {/* Preview */}
        <SplitPreview
          preview={preview}
          userIncluded={userIncluded}
          participants={validParticipants}
          currency={pageCurrency}
          total={totalNum}
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

function SplitPreview({
  preview,
  userIncluded,
  participants,
  currency,
  total,
}: {
  preview: ReturnType<typeof computeSplit> | null;
  userIncluded: boolean;
  participants: ParticipantRow[];
  currency: CurrencyCode;
  total: number;
}) {
  if (!preview) return null;
  if (!preview.ok) {
    return (
      <p className="rounded-xl border border-z-debt/30 bg-z-debt/10 px-3 py-2 text-sm text-z-debt">
        {ERROR_TEXT[preview.reason] ?? "Revisa los montos del reparto."}
      </p>
    );
  }
  return (
    <div className={cn("space-y-1.5 p-4", PANEL_INSET_CLASS)}>
      {userIncluded && (
        <Row label="Tu parte" value={formatCurrency(preview.userShare, currency)} highlight />
      )}
      {preview.shares.map((s, i) => (
        <Row
          key={participants[i]?.key ?? i}
          label={participants[i]?.name ?? "Persona"}
          value={formatCurrency(s.amount, currency)}
        />
      ))}
      <div className="mt-2 flex items-center justify-between border-t border-white/6 pt-2 text-xs text-muted-foreground">
        <span>Total</span>
        <span className="tabular-nums">{formatCurrency(total, currency)}</span>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={cn("truncate", highlight ? "text-z-brass" : "text-foreground")}>{label}</span>
      <span className={cn("tabular-nums", highlight ? "font-semibold text-z-brass" : "")}>
        {value}
      </span>
    </div>
  );
}

const ERROR_TEXT: Record<string, string> = {
  no_participants: "Agrega al menos una persona.",
  invalid_total: "Ingresa el monto total del pago.",
  negative_value: "Los valores no pueden ser negativos.",
  amount_sum_exceeds_total: "Las partes superan el total del pago.",
  amount_sum_mismatch: "Las partes deben sumar exactamente el total.",
  percent_out_of_range: "Los porcentajes superan el 100%.",
  percent_sum_mismatch: "Los porcentajes deben sumar 100%.",
};
