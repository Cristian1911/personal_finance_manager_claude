import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOBILE_BG_CLASS } from "@/lib/constants/styles";
import { MobileAvatarMenu } from "./mobile-avatar-menu";
import { MobileBackButton } from "./mobile-back-button";

// ─── Main tab variant (Inicio, Movimientos, Plan, Deudas) ──────────────────

interface MainHeaderProps {
  variant: "main";
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

// ─── Subpage variant (drill-down pages) ─────────────────────────────────────

interface SubHeaderProps {
  variant: "sub";
  title: string;
  backHref?: string;
  action?: ReactNode;
}

type MobileHeaderProps = MainHeaderProps | SubHeaderProps;

export function MobileHeader(props: MobileHeaderProps) {
  const base = cn(
    "sticky top-0 z-30 flex h-12 items-center border-b border-white/6 px-4 backdrop-blur-md lg:hidden",
    MOBILE_BG_CLASS,
    "supports-[backdrop-filter]:bg-background/90"
  );

  if (props.variant === "sub") {
    return (
      <header className={base}>
        <div className="flex flex-1 items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {props.backHref ? (
              <Link
                href={props.backHref}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-z-sage-light transition-colors hover:bg-white/5"
                aria-label="Volver"
              >
                <ArrowLeft className="size-4" />
              </Link>
            ) : (
              <MobileBackButton />
            )}
            <p className="truncate text-[15px] font-semibold leading-tight text-foreground">
              {props.title}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {props.action}
            <MobileAvatarMenu />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className={base}>
      <div className="flex flex-1 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold leading-tight text-foreground">
            {props.title}
          </p>
          {props.subtitle && (
            <p className="truncate text-[11px] text-muted-foreground leading-tight">
              {props.subtitle}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {props.action && <div className="shrink-0">{props.action}</div>}
          <MobileAvatarMenu />
        </div>
      </div>
    </header>
  );
}
