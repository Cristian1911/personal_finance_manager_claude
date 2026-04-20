import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PANEL_INSET_INTERACTIVE_CLASS } from "@/lib/constants/styles";

interface SettingsNavRowProps {
  title: string;
  meta?: string;
  href: string;
  tone?: "default" | "destructive";
}

export function SettingsNavRow({ title, meta, href, tone = "default" }: SettingsNavRowProps) {
  return (
    <Link
      href={href}
      className={cn(
        PANEL_INSET_INTERACTIVE_CLASS,
        "group flex items-center justify-between gap-3 px-4 py-3",
        tone === "destructive" && "hover:bg-z-debt/5"
      )}
    >
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-semibold leading-tight",
            tone === "destructive" ? "text-z-debt" : "text-foreground"
          )}
        >
          {title}
        </p>
        {meta && (
          <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
        )}
      </div>
      <ChevronRight
        className={cn(
          "size-4 shrink-0 transition-transform group-hover:translate-x-0.5",
          tone === "destructive" ? "text-z-debt" : "text-muted-foreground"
        )}
      />
    </Link>
  );
}
