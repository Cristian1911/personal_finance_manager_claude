"use client";

import { usePathname } from "next/navigation";
import {
  BOTTOM_NAV,
  PRIMARY_NAV,
  WORKSPACE_NAV,
  type NavItem,
} from "@/lib/constants/navigation";
import { NavItemLink } from "./nav-item-link";
import { Wallet } from "lucide-react";

interface SidebarProps {
  uncategorizedCount?: number;
}

export function Sidebar({ uncategorizedCount = 0 }: SidebarProps) {
  const pathname = usePathname();

  function renderNavItem(item: NavItem, variant: "primary" | "secondary") {
    return (
      <NavItemLink
        key={item.href}
        item={item}
        variant={variant}
        pathname={pathname}
        uncategorizedCount={uncategorizedCount}
      />
    );
  }

  return (
    <aside className="sticky top-0 hidden h-screen border-r border-sidebar-border/80 bg-sidebar lg:flex lg:w-72 lg:flex-col">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border/80 px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-z-olive-deep ring-1 ring-inset ring-z-brass/35">
          <Wallet className="h-5 w-5 text-z-sage-light" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">Zeta</p>
          <p className="truncate text-xs text-muted-foreground">Estado y siguiente paso</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <section className="space-y-1.5">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-z-brass">
            Principal
          </p>
          <nav className="space-y-1">
            {PRIMARY_NAV.map((item) => renderNavItem(item, "primary"))}
          </nav>
        </section>

        <section className="space-y-1.5 pt-5">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Herramientas
          </p>
          <nav className="space-y-1">
            {WORKSPACE_NAV.map((item) => renderNavItem(item, "secondary"))}
          </nav>
        </section>
      </div>

      <div className="border-t border-sidebar-border/80 px-3 py-4">
        <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Sistema
        </p>
        <nav className="space-y-1">
          {BOTTOM_NAV.map((item) => renderNavItem(item, "secondary"))}
        </nav>
      </div>
    </aside>
  );
}
