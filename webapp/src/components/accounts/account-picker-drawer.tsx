"use client";

import { Check } from "lucide-react";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { MOBILE_SHEET_SAFE_AREA_CLASS } from "@/lib/constants/styles";
import type { Account } from "@/types/domain";

interface AccountPickerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  value: string | null;
  onSelect: (accountId: string) => void;
  title?: string;
  /** Shown when `accounts` is empty (e.g. no same-currency destination). */
  emptyMessage?: string;
}

/**
 * Bottom-sheet account list (color dot · name · check on the selected one).
 * Shared by the transaction detail page and the mobile create form so picking
 * an account looks the same on both.
 */
export function AccountPickerDrawer({
  open,
  onOpenChange,
  accounts,
  value,
  onSelect,
  title = "Cuenta",
  emptyMessage = "No hay cuentas disponibles",
}: AccountPickerDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <DrawerBody className={cn("px-2", MOBILE_SHEET_SAFE_AREA_CLASS)}>
          {accounts.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </p>
          )}
          {accounts.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onSelect(a.id)}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/5"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: a.color ?? undefined }}
                />
                <span className="truncate">{a.name}</span>
              </span>
              {a.id === value && <Check className="size-4 shrink-0 text-z-brass" />}
            </button>
          ))}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
