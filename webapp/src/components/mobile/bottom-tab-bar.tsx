"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  CreditCard,
  LayoutDashboard,
  Menu,
  PiggyBank,
  Repeat2,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TabConfig } from "@/types/dashboard-config";

interface BottomTabBarProps {
  uncategorizedCount?: number;
  tabConfig?: TabConfig[];
}

type Tab = {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: "uncategorized";
};

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  CreditCard,
  PiggyBank,
  ArrowLeftRight,
  Repeat2,
  TrendingDown,
  Menu,
};

/** Map TabConfig.features to a route */
function featuresToHref(features: string[]): string {
  const key = features.sort().join("+");
  const map: Record<string, string> = {
    "debt+recurring": "/deudas",
    budget: "/categories",
    transactions: "/transactions",
    "budget+transactions": "/categories",
    "budget+savings": "/categories",
    recurring: "/recurrentes",
  };
  return map[key] ?? "/categories";
}

function buildTabs(tabConfig?: TabConfig[]): { left: Tab[]; right: Tab[] } {
  const tab1: Tab = { title: "Inicio", href: "/dashboard", icon: LayoutDashboard };

  const tab4: Tab = { title: "Más", href: "/gestionar", icon: Menu };

  if (!tabConfig || tabConfig.length === 0) {
    // Fallback: default tab bar
    return {
      left: [tab1, { title: "Recurrentes", href: "/recurrentes", icon: Repeat2 }],
      right: [{ title: "Presupuesto", href: "/categories", icon: PiggyBank, badge: "uncategorized" }, tab4],
    };
  }

  const sorted = [...tabConfig].sort((a, b) => a.position - b.position);

  const dynamicTabs: Tab[] = sorted.map((tc) => {
    const hasBudget = tc.features.includes("budget");
    return {
      title: tc.label,
      href: featuresToHref(tc.features),
      icon: ICON_MAP[tc.icon] ?? PiggyBank,
      badge: hasBudget ? "uncategorized" : undefined,
    };
  });

  // Tab 2 goes left, Tab 3 goes right
  const tab2 = dynamicTabs[0];
  const tab3 = dynamicTabs[1];

  return {
    left: [tab1, ...(tab2 ? [tab2] : [])],
    right: [...(tab3 ? [tab3] : []), tab4],
  };
}

export function BottomTabBar({ uncategorizedCount = 0, tabConfig }: BottomTabBarProps) {
  const pathname = usePathname();
  const { left, right } = buildTabs(tabConfig);

  function renderTab(tab: Tab) {
    const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
    const showBadge = tab.badge === "uncategorized" && uncategorizedCount > 0;

    return (
      <Link
        key={tab.href}
        href={tab.href}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "relative flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors",
          isActive
            ? "text-primary"
            : "text-muted-foreground"
        )}
      >
        {/* Active indicator bar */}
        {isActive && (
          <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary" />
        )}
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
        <span className={cn("text-[10px]", isActive ? "font-bold" : "font-medium")}>{tab.title}</span>
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
        {left.map(renderTab)}

        {/* Center gap for FAB */}
        <div className="w-16 shrink-0" />

        {/* Right tabs */}
        {right.map(renderTab)}
      </div>
    </nav>
  );
}
