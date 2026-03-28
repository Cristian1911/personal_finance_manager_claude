"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PRIMARY_NAV, isNavItemActive, type NavItem } from "@/lib/constants/navigation";

interface BottomTabBarProps {
  uncategorizedCount?: number;
}

export function BottomTabBar({ uncategorizedCount = 0 }: BottomTabBarProps) {
  const pathname = usePathname();
  const leftTabs = PRIMARY_NAV.slice(0, 2);
  const rightTabs = PRIMARY_NAV.slice(2);

  function renderTab(tab: NavItem) {
    const isActive = isNavItemActive(pathname, tab);
    const showBadge = tab.badge === "uncategorized" && uncategorizedCount > 0;

    return (
      <Link
        key={tab.href}
        href={tab.href}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "relative flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl border px-2 transition-all",
          isActive
            ? "border-z-brass/35 bg-z-olive-deep text-z-sage-light shadow-sm"
            : "border-transparent text-muted-foreground"
        )}
      >
        <span className="relative">
          <tab.icon className={cn("size-5", isActive && "stroke-[2.5]")} />
          {showBadge && (
            <span
              className={cn(
                "absolute -top-1.5 -right-2.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold",
                isActive
                  ? "bg-z-brass text-z-white"
                  : "bg-primary/15 text-primary"
              )}
            >
              {uncategorizedCount > 99 ? "99+" : uncategorizedCount}
            </span>
          )}
        </span>
        <span className={cn("text-[10px]", isActive ? "font-bold" : "font-medium")}>
          {tab.title}
        </span>
      </Link>
    );
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/92 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex gap-2 px-3 py-2">
        {leftTabs.map(renderTab)}
        <div className="w-16 shrink-0" aria-hidden="true" />
        {rightTabs.map(renderTab)}
      </div>
    </nav>
  );
}
