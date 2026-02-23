"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MAIN_NAV, BOTTOM_NAV } from "@/lib/constants/navigation";
import { Wallet } from "lucide-react";

interface SidebarProps {
  uncategorizedCount?: number;
}

export function Sidebar({ uncategorizedCount = 0 }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r bg-card h-screen sticky top-0">
      <div className="flex items-center gap-2 px-6 h-16 border-b shrink-0">
        <Wallet className="h-6 w-6 text-primary" />
        <span className="font-semibold text-lg">Finance Manager</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {MAIN_NAV.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const showBadge =
            item.badge === "uncategorized" && uncategorizedCount > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.title}</span>
              {showBadge && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                  {uncategorizedCount > 99 ? "99+" : uncategorizedCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t px-3 py-4 space-y-1">
        {BOTTOM_NAV.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
