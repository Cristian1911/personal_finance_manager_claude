import type { ReactNode } from "react";
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
}

type MobileHeaderProps = DashboardHeaderProps | PageHeaderProps;

export function MobileHeader(props: MobileHeaderProps) {
  const base =
    "sticky top-0 z-30 h-12 lg:hidden flex items-center border-b border-white/5 bg-[#0e100e]/95 backdrop-blur-md px-4";

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

        {props.action && (
          <div className="shrink-0">{props.action}</div>
        )}
      </div>
    </header>
  );
}
