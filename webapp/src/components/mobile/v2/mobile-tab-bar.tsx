"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { MOBILE_TABS, isMobileTabActive } from "@/lib/constants/mobile-nav";
import { MOBILE_BG_CLASS } from "@/lib/constants/styles";
import type { Account, CategoryWithChildren } from "@/types/domain";

const MobileTransactionForm = dynamic(
  () => import("@/components/mobile/mobile-transaction-form").then((m) => ({
    default: m.MobileTransactionForm,
  })),
  { ssr: false, loading: () => null }
);

interface MobileTabBarProps {
  accounts: Account[];
  categories: CategoryWithChildren[];
}

export function MobileTabBar({ accounts, categories }: MobileTabBarProps) {
  const pathname = usePathname();
  const keyboardInset = useKeyboardInset();
  const [formOpen, setFormOpen] = useState(false);

  const keyboardOpen = keyboardInset > 0;

  const leftTabs = MOBILE_TABS.slice(0, 2);
  const rightTabs = MOBILE_TABS.slice(2);

  return (
    <>
      {/* Full tab bar — hidden when keyboard is open or form is open */}
      {!keyboardOpen && !formOpen && (
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
                onClick={() => setFormOpen(true)}
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
      )}

      {/* Floating FAB — sits above keyboard when it's open on the page (not in form) */}
      {keyboardOpen && !formOpen && (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="fixed left-1/2 z-[9999] flex size-11 -translate-x-1/2 items-center justify-center rounded-full bg-z-brass text-z-ink shadow-[0_0_16px_rgba(184,148,79,0.4)] lg:hidden"
          style={{ bottom: `${keyboardInset + 12}px` }}
          aria-label="Registrar movimiento"
        >
          <Plus className="size-4 stroke-[2.5]" />
        </button>
      )}

      {/* Full-screen transaction form — replaces the old drawer */}
      {formOpen && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col bg-background lg:hidden"
          style={{
            paddingTop: "env(safe-area-inset-top)",
            paddingBottom: keyboardOpen
              ? `${keyboardInset}px`
              : "env(safe-area-inset-bottom)",
          }}
        >
          {/* Header */}
          <div className="flex items-center border-b border-border/40 px-4 py-3">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-accent"
              aria-label="Cerrar"
            >
              <X className="size-5" />
            </button>
            <h2 className="flex-1 text-center text-base font-semibold">
              Registrar movimiento
            </h2>
            <div className="size-8" />
          </div>

          {/* Scrollable form */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            <MobileTransactionForm
              accounts={accounts}
              categories={categories}
              onSuccess={() => setFormOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
