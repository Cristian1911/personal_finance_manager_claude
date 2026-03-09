"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Repeat2,
  PiggyBank,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomTabBarProps {
  uncategorizedCount?: number;
}

type Tab = {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: "uncategorized";
  position: "left" | "right";
};

const TABS: Tab[] = [
  { title: "Inicio", href: "/dashboard", icon: LayoutDashboard, position: "left" },
  { title: "Recurrentes", href: "/recurrentes", icon: Repeat2, position: "left" },
  { title: "Presupuesto", href: "/categories", icon: PiggyBank, badge: "uncategorized", position: "right" },
  { title: "Gestionar", href: "/gestionar", icon: Wrench, position: "right" },
];

export function BottomTabBar({ uncategorizedCount = 0 }: BottomTabBarProps) {
  const pathname = usePathname();

  const leftTabs = TABS.filter((t) => t.position === "left");
  const rightTabs = TABS.filter((t) => t.position === "right");

  function renderTab(tab: Tab) {
    const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
    const showBadge = tab.badge === "uncategorized" && uncategorizedCount > 0;

    return (
      <Link
        key={tab.href}
        href={tab.href}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors",
          isActive
            ? "text-primary"
            : "text-muted-foreground"
        )}
      >
        <span className="relative">
          <tab.icon
            className={cn("size-5", isActive && "stroke-[2.5]")}
          />
          {showBadge && (
            <span className="absolute -top-1.5 -right-2.5 inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {uncategorizedCount > 99 ? "99+" : uncategorizedCount}
            </span>
          )}
        </span>
        <span className="text-[10px] font-medium">{tab.title}</span>
      </Link>
    );
  }

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t bg-background/80 backdrop-blur-lg lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-14">
        {/* Left tabs */}
        {leftTabs.map(renderTab)}

        {/* Center gap for FAB */}
        <div className="w-16 shrink-0" />

        {/* Right tabs */}
        {rightTabs.map(renderTab)}
      </div>
    </nav>
  );
}
