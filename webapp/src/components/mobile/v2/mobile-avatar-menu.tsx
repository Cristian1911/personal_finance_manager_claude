"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { BellDot, ChevronRight, Menu, Settings, Upload } from "lucide-react";
import { useCloseOnNavigate } from "@/hooks/use-close-on-navigate";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useMobileShell } from "./mobile-shell-provider";

interface MobileAvatarMenuProps {
  name?: string | null;
  email?: string | null;
}

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return "ZT";
}

export function MobileAvatarMenu({ name, email }: MobileAvatarMenuProps) {
  const shell = useMobileShell();
  const [open, setOpen] = useState(false);
  useCloseOnNavigate(useCallback(() => setOpen(false), []));

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", close, { capture: true });
  }, [open]);

  const resolvedName = name ?? shell?.name ?? null;
  const resolvedEmail = email ?? shell?.email ?? null;
  const attentionCount = shell?.attentionCount ?? 0;
  const attentionSummary = shell?.attentionSummary ?? "Todo en orden por ahora";
  const initials = getInitials(resolvedName, resolvedEmail);
  const attentionBadge = attentionCount > 9 ? "9+" : `${attentionCount}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative flex size-8 items-center justify-center rounded-full border border-z-brass/30 bg-z-brass/10 text-[10px] font-semibold text-z-brass transition-colors hover:bg-z-brass/20"
          aria-label="Menú de perfil"
        >
          {initials}
          {attentionCount > 0 && (
            <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-z-brass px-1 text-[9px] font-bold leading-none text-z-ink">
              {attentionBadge}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-56 border border-white/6 bg-z-surface-2/95 p-0 shadow-xl backdrop-blur-xl"
      >
        <div className="px-3.5 py-3">
          <p className="text-sm font-medium text-foreground leading-tight">
            {resolvedName ?? "Usuario"}
          </p>
          {resolvedEmail && (
            <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
              {resolvedEmail}
            </p>
          )}
        </div>

        <Separator className="bg-white/6" />

        <Link
          href="/gestionar"
          className="mx-2 my-2 flex items-start gap-3 rounded-2xl border border-z-brass/20 bg-z-brass/8 px-3.5 py-3 transition-colors hover:bg-z-brass/12"
        >
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-z-brass/12 text-z-brass">
            <BellDot className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-brass">
                Atención
              </p>
              {attentionCount > 0 && (
                <span className="rounded-full bg-z-brass px-1.5 py-0.5 text-[10px] font-semibold text-z-ink">
                  {attentionBadge}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm leading-tight text-foreground">
              {attentionSummary}
            </p>
            <p className="mt-1 text-[11px] text-z-brass">
              Ir a gestionar
            </p>
          </div>
          <ChevronRight className="mt-0.5 size-4 shrink-0 text-z-brass/70" />
        </Link>

        <Separator className="bg-white/6" />

        <div className="py-1.5">
          <Link
            href="/settings"
            className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-foreground/80 transition-colors hover:bg-white/4 hover:text-foreground"
          >
            <Settings className="size-3.5 shrink-0 text-muted-foreground" />
            Ajustes
          </Link>
          <Link
            href="/import"
            className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-foreground/80 transition-colors hover:bg-white/4 hover:text-foreground"
          >
            <Upload className="size-3.5 shrink-0 text-muted-foreground" />
            Importar extracto
          </Link>
        </div>

        <Separator className="bg-white/6" />

        <div className="py-1.5">
          <Link
            href="/menu"
            className="flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-z-brass transition-colors hover:bg-z-brass/8"
          >
            <Menu className="size-3.5 shrink-0" />
            Ver todo
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
