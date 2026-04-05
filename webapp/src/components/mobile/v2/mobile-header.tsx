import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MOBILE_BG_CLASS } from "@/lib/constants/styles";
import { MobileAvatarMenu } from "./mobile-avatar-menu";

// ─── Dashboard variant ────────────────────────────────────────────────────────

interface DashboardHeaderProps {
  variant: "dashboard";
  name?: string | null;
  email?: string | null;
}

// ─── Page variant ─────────────────────────────────────────────────────────────

interface PageHeaderProps {
  variant: "page";
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** When set, shows a static chip instead of the avatar menu */
  chip?: string;
}

type MobileHeaderProps = DashboardHeaderProps | PageHeaderProps;

export function MobileHeader(props: MobileHeaderProps) {
  const base = cn(
    "sticky top-0 z-30 flex h-12 items-center border-b border-white/6 px-4 backdrop-blur-md lg:hidden",
    MOBILE_BG_CLASS,
    "supports-[backdrop-filter]:bg-background/90"
  );

  if (props.variant === "dashboard") {
    return (
      <header className={base}>
        <div className="flex flex-1 items-center justify-between">
          {/* ZETA wordmark */}
          <span className="text-[15px] font-bold tracking-[0.12em] text-foreground">
            ZETA
          </span>

          <MobileAvatarMenu name={props.name} email={props.email} />
        </div>
      </header>
    );
  }

  return (
    <header className={base}>
      <div className="flex flex-1 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold leading-tight text-foreground">
            {props.title}
          </p>
          {props.subtitle && (
            <p className="truncate text-[11px] text-muted-foreground leading-tight">
              {props.subtitle}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {props.action && (
            <div className="shrink-0">{props.action}</div>
          )}
          {props.chip ? (
            <span className="rounded-full border border-white/6 bg-black/10 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
              {props.chip}
            </span>
          ) : (
            <MobileAvatarMenu />
          )}
        </div>
      </div>
    </header>
  );
}
