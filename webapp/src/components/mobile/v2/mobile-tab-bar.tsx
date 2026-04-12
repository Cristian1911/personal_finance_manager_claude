"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOBILE_TABS, isMobileTabActive } from "@/lib/constants/mobile-nav";
import { MOBILE_BG_CLASS } from "@/lib/constants/styles";
import { useMobileActionMenu } from "@/components/mobile/mobile-sheet-provider";

const LEFT_TABS = MOBILE_TABS.slice(0, 2);
const RIGHT_TABS = MOBILE_TABS.slice(2);
const SAFE_AREA_BOTTOM_STYLE = { paddingBottom: "env(safe-area-inset-bottom)" } as const;

function TabLinks({ tabs, pathname }: { tabs: typeof MOBILE_TABS; pathname: string }) {
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
  const { openActionMenu } = useMobileActionMenu();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[9999] lg:hidden"
      style={SAFE_AREA_BOTTOM_STYLE}
    >
      <div
        className={cn(
          "flex items-center border-t border-white/6 backdrop-blur-md supports-[backdrop-filter]:bg-background/92",
          MOBILE_BG_CLASS
        )}
      >
        <TabLinks tabs={LEFT_TABS} pathname={pathname} />

        <div className="relative flex shrink-0 items-center justify-center px-4 py-2">
          <button
            type="button"
            onClick={openActionMenu}
            className="flex size-12 -mt-4 items-center justify-center rounded-full bg-z-brass text-z-ink shadow-[0_0_16px_rgba(184,148,79,0.4)] transition-transform active:scale-95"
            aria-label="Abrir menu de acciones"
          >
            <Plus className="size-5 stroke-[2.5]" />
          </button>
        </div>

        <TabLinks tabs={RIGHT_TABS} pathname={pathname} />
      </div>
    </nav>
  );
}
