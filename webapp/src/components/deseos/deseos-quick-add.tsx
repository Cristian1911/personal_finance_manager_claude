"use client";

import { useState, useTransition, useRef } from "react";
import { Plus } from "lucide-react";
import { createWishlistItem } from "@/actions/wishlist";
import type { CurrencyCode } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";

type DeseosQuickAddProps = {
  currency: CurrencyCode;
};

export function DeseosQuickAdd({ currency }: DeseosQuickAddProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("currency_code", currency);

    startTransition(async () => {
      const result = await createWishlistItem(formData);
      if (result.success) {
        formRef.current?.reset();
        setIsOpen(false);
      } else {
        setError(result.error);
      }
    });
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-white/10 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground"
      >
        <Plus className="size-4" />
        Agregar deseo rapido...
      </button>
    );
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <Input
          name="name"
          placeholder="Nombre del deseo"
          autoFocus
          required
          className="flex-1"
          disabled={isPending}
        />
        <CurrencyInput
          name="amount"
          placeholder="Monto"
          required
          className="w-32"
          disabled={isPending}
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setIsOpen(false);
            setError(null);
          }}
          disabled={isPending}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          size="sm"
          className="bg-z-brass text-z-ink hover:bg-z-brass/90"
          disabled={isPending}
        >
          Agregar
        </Button>
      </div>
    </form>
  );
}
