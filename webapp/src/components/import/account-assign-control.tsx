"use client";

import { useState } from "react";
import { AlertCircle, ChevronDown, Landmark, Plus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/domain";

type Props = {
  accounts: Account[];
  accountId: string;
  autoMatched?: boolean;
  onSelect: (accountId: string) => void;
  onCreate: () => void;
  /** "card" (default) = full-card trigger. "pill" = single-row rounded-full pill (inline with other chips). */
  variant?: "card" | "pill";
};

/**
 * Prominent account assignment control shown directly under the StatementChip.
 * Brass attention state when unmatched; matched state shows account name inline.
 */
export function AccountAssignControl({
  accounts,
  accountId,
  onSelect,
  onCreate,
  variant = "card",
}: Props) {
  const [open, setOpen] = useState(false);
  const account = accounts.find((a) => a.id === accountId);
  const unmatched = !account;
  const pill = variant === "pill";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unmatched ? "Asignar cuenta" : `Cuenta: ${account.name}`}
          className={cn(
            "flex items-center gap-2 text-left transition-colors",
            pill
              ? cn(
                  "h-9 min-w-0 rounded-full border px-3 text-sm font-semibold",
                  unmatched
                    ? "border-z-brass bg-z-brass/12 text-z-brass hover:bg-z-brass/18"
                    : "border-white/6 bg-z-surface-2/80 text-z-sage-light hover:border-white/15",
                )
              : cn(
                  "w-full justify-between rounded-xl border px-4 py-3",
                  unmatched
                    ? "border-z-brass bg-z-brass/12 text-z-brass hover:bg-z-brass/18"
                    : "border-white/6 bg-z-surface-2/80 text-z-sage-light hover:border-white/15",
                ),
          )}
        >
          {unmatched ? (
            <AlertCircle className="h-4 w-4 shrink-0" />
          ) : (
            <Landmark className="h-4 w-4 shrink-0 text-z-brass" />
          )}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            {unmatched ? "Asignar cuenta" : account.name}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-80" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        collisionPadding={12}
        className="w-[min(92vw,20rem)] p-1"
      >
        <div className="max-h-72 overflow-auto">
          {accounts.length === 0 ? (
            <p className="px-3 py-3 text-center text-xs text-z-sage-dark">
              No tienes cuentas aún.
            </p>
          ) : (
            <ul className="space-y-0.5" role="listbox">
              {accounts.map((acc) => (
                <li key={acc.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={acc.id === accountId}
                    onClick={() => {
                      onSelect(acc.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                      acc.id === accountId
                        ? "bg-z-brass/12 text-z-brass"
                        : "text-z-sage-light hover:bg-white/6",
                    )}
                  >
                    <span className="min-w-0 truncate font-medium">
                      {acc.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-1 border-t border-white/6 pt-1">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onCreate();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-z-brass hover:bg-z-brass/8"
          >
            <Plus className="h-4 w-4" />
            Crear nueva cuenta
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
