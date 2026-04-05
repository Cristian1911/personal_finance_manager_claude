import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PANEL_INSET_CLASS, PANEL_INSET_INTERACTIVE_CLASS } from "@/lib/constants/styles";

interface HubEntryProps {
  href: string;
  icon: LucideIcon;
  title: string;
  hint: ReactNode;
  className?: string;
}

export function HubEntry({ href, icon: Icon, title, hint, className }: HubEntryProps) {
  return (
    <Link
      href={href}
      className={cn(
        `${PANEL_INSET_INTERACTIVE_CLASS} flex items-center gap-3 rounded-2xl px-3.5 py-3 active:bg-white/[0.03]`,
        className,
      )}
    >
      <div
        className={cn(
          PANEL_INSET_CLASS,
          "flex size-8 shrink-0 items-center justify-center rounded-xl bg-z-brass/10"
        )}
      >
        <Icon className="size-4 text-z-brass" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight text-foreground">
          {title}
        </p>
        <p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">
          {hint}
        </p>
      </div>

      <span className="shrink-0 text-[16px] leading-none text-muted-foreground/50">
        ›
      </span>
    </Link>
  );
}
