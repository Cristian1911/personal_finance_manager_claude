"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Receipt, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import { CreatePersonalDebtSheet } from "./create-personal-debt-sheet";
import type { CurrencyCode } from "@/types/domain";

/**
 * The one "Nueva" entry point of the page: a person-to-person debt (sheet) or
 * a shared payment (its own route). Self-contained so the server page can drop
 * it into both the MobileHeader action slot and the desktop header row.
 */
export function NewDebtMenu({ currency, compact }: { currency: CurrencyCode; compact?: boolean }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className={cn(BRASS_BUTTON_CLASS)} size={compact ? "sm" : "default"} aria-label="Nueva deuda">
            <Plus className="size-4" />
            {compact ? "Nueva" : "Nueva deuda"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
            <Users className="size-4" />
            Deuda personal
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push("/deudas-personales/pago-compartido/nuevo")}>
            <Receipt className="size-4" />
            Pago compartido
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Conditionally mounted so internal state resets on every open. */}
      {createOpen && (
        <CreatePersonalDebtSheet open={createOpen} onOpenChange={setCreateOpen} currency={currency} />
      )}
    </>
  );
}
