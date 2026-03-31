"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { isNavItemActive, type NavItem } from "@/lib/constants/navigation";
import type { AttentionSnapshot } from "@/types/attention";

interface NavItemLinkProps {
  item: NavItem;
  variant: "primary" | "secondary";
  pathname: string;
  attentionSnapshot?: AttentionSnapshot;
  onNavigate?: () => void;
}

export function formatBadgeCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

export function NavItemLink({
  item,
  variant,
  pathname,
  attentionSnapshot,
  onNavigate,
}: NavItemLinkProps) {
  const isActive = isNavItemActive(pathname, item);

  // Badge logic: primary "attention" badge or workspace per-page badge
  let badgeCount = 0;
  let badgeStyle: "brass" | "muted" = "muted";

  if (item.badge === "attention" && attentionSnapshot) {
    badgeCount = attentionSnapshot.totalAction;
    badgeStyle = "brass";
  } else if (variant === "secondary" && attentionSnapshot && item.attentionPage) {
    badgeCount = attentionSnapshot.perPage[item.attentionPage] ?? 0;
    badgeStyle = "muted";
  }

  const showBadge = badgeCount > 0;

  return (
    <Link
      key={item.href}
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
        variant === "primary" ? "font-medium" : "font-normal",
        isActive && variant === "primary"
          ? "bg-z-olive-deep text-z-sage-light ring-1 ring-inset ring-z-brass/35 shadow-sm"
          : isActive
            ? "bg-muted/80 text-foreground ring-1 ring-inset ring-border/80"
            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{item.title}</span>
      {showBadge && (
        <span
          className={cn(
            "inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
            badgeStyle === "brass"
              ? isActive && variant === "primary"
                ? "bg-z-brass text-z-white"
                : "bg-z-brass/20 text-z-brass"
              : "bg-muted text-muted-foreground"
          )}
        >
          {formatBadgeCount(badgeCount)}
        </span>
      )}
    </Link>
  );
}
