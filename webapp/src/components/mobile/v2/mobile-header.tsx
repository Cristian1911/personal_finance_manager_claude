import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";
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
  /**
   * Visual treatment for the back affordance:
   *  - "back" (default): left-arrow + "Volver" label — implies stepwise return.
   *  - "exit": X icon + "Salir" label — implies leaving a flow with state.
   *
   * Use "exit" on focus-mode wizards once the user has crossed a commitment
   * threshold, so the header back is clearly distinct from any in-flow
   * "Atrás" button (which steps backward without losing state).
   */
  backStyle?: "back" | "exit";
}

type MobileHeaderProps = MainHeaderProps | SubHeaderProps;

export function MobileHeader(props: MobileHeaderProps) {
  const base = cn(
    "sticky top-0 z-[var(--z-layer-sticky)] flex h-12 items-center border-b border-white/6 px-4 backdrop-blur-md lg:hidden",
    MOBILE_BG_CLASS,
    "supports-[backdrop-filter]:bg-background/90"
  );

  if (props.variant === "sub") {
    const isExit = props.backStyle === "exit";
    const Icon = isExit ? X : ArrowLeft;
    const label = isExit ? "Salir" : "Volver";
    return (
      <header className={base}>
        <div className="flex flex-1 items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {props.backHref ? (
              <Link
                href={props.backHref}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-z-sage-light transition-colors hover:bg-white/5"
                aria-label={label}
              >
                <Icon className="size-4" />
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
