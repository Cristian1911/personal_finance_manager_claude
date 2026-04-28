"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { getMobileTabs, isMobileTabActive } from "@/lib/constants/mobile-nav";
import { MOBILE_BG_CLASS } from "@/lib/constants/styles";
import { useMobileActionMenu } from "@/components/mobile/mobile-sheet-provider";
import { useNavFocus } from "@/components/providers/nav-focus-provider";

const SAFE_AREA_BOTTOM_STYLE = { paddingBottom: "env(safe-area-inset-bottom)" } as const;

type Tab = ReturnType<typeof getMobileTabs>[number];

function TabLinks({ tabs, pathname }: { tabs: Tab[]; pathname: string }) {
  return (
    <div className="flex flex-1 items-center justify-around">
      {tabs.map((tab) => {
        const active = isMobileTabActive(pathname, tab);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors",
              active ? "text-z-brass" : "text-muted-foreground/70"
            )}
          >
            <tab.icon className="size-5" />
            {tab.title}
          </Link>
        );
      })}
    </div>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  const { openActionMenu, isFabOpen } = useMobileActionMenu();
  const keyboardInset = useKeyboardInset();
  const focus = useNavFocus();

  if (keyboardInset > 0) return null;

  const tabs = getMobileTabs(focus);
  const leftTabs = tabs.slice(0, 2);
  const rightTabs = tabs.slice(2);

  return (
    <nav
      data-fab-bar
      className="fixed bottom-0 left-0 right-0 z-[9999] lg:hidden"
      style={SAFE_AREA_BOTTOM_STYLE}
    >
      <div
        className={cn(
          "flex items-center border-t border-white/6 backdrop-blur-md supports-[backdrop-filter]:bg-background/92",
          MOBILE_BG_CLASS
        )}
      >
        <TabLinks tabs={leftTabs} pathname={pathname} />

        <div className="relative flex shrink-0 items-center justify-center px-4 py-2">
          <button
            type="button"
            onClick={openActionMenu}
            className="flex size-12 -mt-4 items-center justify-center rounded-full bg-z-brass text-z-ink shadow-[0_0_16px_rgba(184,148,79,0.4)] transition-transform active:scale-95"
            aria-label={isFabOpen ? "Cerrar menu de acciones" : "Abrir menu de acciones"}
          >
            <Plus className={cn("size-5 stroke-[2.5] transition-transform duration-200", isFabOpen && "rotate-45")} />
          </button>
        </div>

        <TabLinks tabs={rightTabs} pathname={pathname} />
      </div>
    </nav>
  );
}
