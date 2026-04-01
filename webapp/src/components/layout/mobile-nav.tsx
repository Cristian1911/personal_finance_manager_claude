"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  BOTTOM_NAV,
  PRIMARY_NAV,
  WORKSPACE_NAV,
  type NavItem,
} from "@/lib/constants/navigation";
import { BrandIcon } from "@/components/app/brand-icon";
import { NavItemLink } from "./nav-item-link";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import type { AttentionSnapshot } from "@/types/attention";

interface MobileNavProps {
  attentionSnapshot?: AttentionSnapshot;
}

export function MobileNav({ attentionSnapshot }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  function renderNavItem(item: NavItem, variant: "primary" | "secondary") {
    return (
      <NavItemLink
        key={item.href}
        item={item}
        variant={variant}
        pathname={pathname}
        attentionSnapshot={attentionSnapshot}
        onNavigate={() => setOpen(false)}
      />
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Menú</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 border-sidebar-border/80 bg-sidebar p-0">
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border/80 px-6">
          <BrandIcon
            className="h-10 w-10 rounded-2xl ring-1 ring-inset ring-z-brass/35 shadow-[0_12px_28px_rgba(0,0,0,0.24)]"
            priority
          />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">Zeta</p>
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
      </SheetContent>
    </Sheet>
  );
}
