"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { MOBILE_TABS, isMobileTabActive } from "@/lib/constants/mobile-nav";
import { MOBILE_BG_CLASS } from "@/lib/constants/styles";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { MobileTransactionForm } from "@/components/mobile/mobile-transaction-form";
import type { Account, CategoryWithChildren } from "@/types/domain";

interface MobileTabBarProps {
  accounts: Account[];
  categories: CategoryWithChildren[];
}

export function MobileTabBar({ accounts, categories }: MobileTabBarProps) {
  const pathname = usePathname();
  const keyboardInset = useKeyboardInset();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (keyboardInset > 0) return null;

  const leftTabs = MOBILE_TABS.slice(0, 2);
  const rightTabs = MOBILE_TABS.slice(2);

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-[9999] lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div
          className={cn(
            "flex items-center border-t border-white/6 backdrop-blur-md supports-[backdrop-filter]:bg-background/92",
            MOBILE_BG_CLASS
          )}
        >
          <div className="flex flex-1 items-center justify-around">
            {leftTabs.map((tab) => {
              const active = isMobileTabActive(pathname, tab);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors",
                    active ? "text-z-brass" : "text-muted-foreground/70"
                  )}
                >
                  <tab.icon className="size-[18px]" />
                  {tab.title}
                </Link>
              );
            })}
          </div>

          <div className="flex shrink-0 items-center justify-center px-4 py-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex size-[34px] items-center justify-center rounded-full bg-z-brass text-z-ink shadow-[0_0_12px_rgba(184,148,79,0.35)] transition-transform active:scale-95"
              aria-label="Registrar movimiento"
            >
              <Plus className="size-4 stroke-[2.5]" />
            </button>
          </div>

          <div className="flex flex-1 items-center justify-around">
            {rightTabs.map((tab) => {
              const active = isMobileTabActive(pathname, tab);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors",
                    active ? "text-z-brass" : "text-muted-foreground/70"
                  )}
                >
                  <tab.icon className="size-[18px]" />
                  {tab.title}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader>
            <DrawerTitle>Registrar movimiento</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-4">
            <MobileTransactionForm
              accounts={accounts}
              categories={categories}
              onSuccess={() => setDrawerOpen(false)}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
