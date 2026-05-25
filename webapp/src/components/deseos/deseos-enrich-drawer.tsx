"use client";

import { useState, useTransition } from "react";
import { enrichWishlistItem, scoreWishlistItem } from "@/actions/wishlist";
import type { ScoredWishlistItem } from "@/actions/wishlist";
import type { Account } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerTitle,
} from "@/components/ui/drawer";

type DeseosEnrichDrawerProps = {
  item: ScoredWishlistItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentAccounts: Account[];
};

export function DeseosEnrichDrawer({
  item,
  open,
  onOpenChange,
  paymentAccounts,
}: DeseosEnrichDrawerProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [urgency, setUrgency] = useState<string>(item.urgency ?? "");
  const [desireType, setDesireType] = useState<string>(item.desire_type ?? "");
  const [fundingType, setFundingType] = useState<string>(
    item.funding_type ?? ""
  );
  const [installments, setInstallments] = useState<string>(
    item.installments?.toString() ?? ""
  );
  const [accountId, setAccountId] = useState<string>(item.account_id ?? "");
  const [why, setWhy] = useState<string>(item.why ?? "");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!urgency || !desireType || !fundingType) {
      setError("Completa todos los campos requeridos");
      return;
    }

    startTransition(async () => {
      const enrichResult = await enrichWishlistItem({
        id: item.id,
        why: why || undefined,
        urgency,
        desire_type: desireType,
        funding_type: fundingType,
        installments:
          fundingType === "INSTALLMENTS" && installments
            ? Number(installments)
            : null,
        account_id: accountId || null,
      });

      if (!enrichResult.success) {
        setError(enrichResult.error);
        return;
      }

      // Score the enriched item
      await scoreWishlistItem(item.id);
      onOpenChange(false);
    });
  }

  const urgencyOptions = [
    { value: "NECESSARY", label: "Necesario" },
    { value: "USEFUL", label: "Util" },
    { value: "IMPULSE", label: "Impulso" },
  ];

  const desireTypeOptions = [
    { value: "long_held", label: "Hace rato" },
    { value: "recent", label: "Reciente" },
    { value: "spontaneous", label: "Espontaneo" },
  ];

  const fundingOptions = [
    { value: "ONE_TIME", label: "De contado" },
    { value: "INSTALLMENTS", label: "Cuotas" },
  ];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DrawerHeader>
            <DrawerTitle>Completar: {item.name}</DrawerTitle>
          </DrawerHeader>
          <DrawerBody className="space-y-5">
          {/* Why */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Por que lo quieres? (opcional)
            </label>
            <textarea
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Describe tu motivacion..."
              autoComplete="off"
              className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-z-brass focus:outline-none"
            />
          </div>

          {/* Urgency */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Urgencia
            </label>
            <div className="grid grid-cols-3 gap-2">
              {urgencyOptions.map((opt) => (
                <label
                  key={opt.value}
                  className={`group flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-sm transition-colors has-[:checked]:border-z-brass has-[:checked]:bg-z-brass/10 has-[:checked]:text-z-brass ${
                    urgency !== opt.value
                      ? "border-white/10 text-muted-foreground hover:border-white/20"
                      : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="urgency"
                    value={opt.value}
                    checked={urgency === opt.value}
                    onChange={(e) => setUrgency(e.target.value)}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Desire type */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Tipo de deseo
            </label>
            <div className="grid grid-cols-3 gap-2">
              {desireTypeOptions.map((opt) => (
                <label
                  key={opt.value}
                  className={`group flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-sm transition-colors has-[:checked]:border-z-brass has-[:checked]:bg-z-brass/10 has-[:checked]:text-z-brass ${
                    desireType !== opt.value
                      ? "border-white/10 text-muted-foreground hover:border-white/20"
                      : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="desire_type"
                    value={opt.value}
                    checked={desireType === opt.value}
                    onChange={(e) => setDesireType(e.target.value)}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Funding */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Forma de pago
            </label>
            <div className="grid grid-cols-2 gap-2">
              {fundingOptions.map((opt) => (
                <label
                  key={opt.value}
                  className={`group flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-sm transition-colors has-[:checked]:border-z-brass has-[:checked]:bg-z-brass/10 has-[:checked]:text-z-brass ${
                    fundingType !== opt.value
                      ? "border-white/10 text-muted-foreground hover:border-white/20"
                      : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="funding_type"
                    value={opt.value}
                    checked={fundingType === opt.value}
                    onChange={(e) => setFundingType(e.target.value)}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Installments — only when INSTALLMENTS funding */}
          {fundingType === "INSTALLMENTS" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Numero de cuotas
              </label>
              <Input
                type="number"
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                min={2}
                max={36}
                placeholder="Ej: 12"
                className="w-32"
              />
            </div>
          )}

          {/* Account */}
          {paymentAccounts.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Cuenta de pago
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm focus:border-z-brass focus:outline-none"
              >
                <option value="">Seleccionar cuenta...</option>
                {paymentAccounts.map((acct) => (
                  <option key={acct.id} value={acct.id}>
                    {acct.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <Button
            type="submit"
            className="w-full bg-z-brass text-z-ink hover:bg-z-brass/90"
            disabled={isPending}
          >
            {isPending ? "Guardando..." : "Guardar y evaluar"}
          </Button>
          </DrawerBody>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
