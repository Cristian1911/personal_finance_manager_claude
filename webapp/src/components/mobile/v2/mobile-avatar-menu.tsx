"use client";

import Link from "next/link";
import { Settings, Upload, Menu } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

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
  const initials = getInitials(name, email);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex size-7 items-center justify-center rounded-full border border-z-brass/30 bg-z-brass/10 text-[10px] font-semibold text-z-brass transition-colors hover:bg-z-brass/20"
          aria-label="Menú de perfil"
        >
          {initials}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-52 border border-white/8 bg-[#161816] p-0 shadow-xl"
      >
        {/* Profile section */}
        <div className="px-3.5 py-3">
          <p className="text-sm font-medium text-foreground leading-tight">
            {name ?? "Usuario"}
          </p>
          {email && (
            <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
              {email}
            </p>
          )}
        </div>

        <Separator className="bg-white/6" />

        {/* Links */}
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
