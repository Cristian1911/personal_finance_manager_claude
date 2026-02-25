"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MAIN_NAV, BOTTOM_NAV } from "@/lib/constants/navigation";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Wallet } from "lucide-react";

interface MobileNavProps {
  uncategorizedCount?: number;
}

export function MobileNav({ uncategorizedCount = 0 }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Menú</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <div className="flex items-center gap-2 px-6 h-16 border-b">
          <Wallet className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg">Venti5</span>
        </div>

        <nav className="px-3 py-4 space-y-1">
          {MAIN_NAV.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const showBadge =
              item.badge === "uncategorized" && uncategorizedCount > 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
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
                onClick={() => setOpen(false)}
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
      </SheetContent>
    </Sheet>
  );
}
