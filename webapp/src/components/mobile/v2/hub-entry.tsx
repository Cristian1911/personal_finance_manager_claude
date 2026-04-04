import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
        "flex items-center gap-3 rounded-[14px] border border-white/5 bg-[#161816] px-3.5 py-3 transition-colors active:bg-white/[0.03]",
        className,
      )}
    >
      {/* Icon container */}
      <div className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-z-brass/10">
        <Icon className="size-4 text-z-brass" />
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight text-foreground">
          {title}
        </p>
        <p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">
          {hint}
        </p>
      </div>

      {/* Arrow */}
      <span className="shrink-0 text-[16px] leading-none text-muted-foreground/50">
        ›
      </span>
    </Link>
  );
}
