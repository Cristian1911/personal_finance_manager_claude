"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  parseMonth,
  formatMonthParam,
  formatMonthLabel,
  formatMonthLabelShort,
  isCurrentMonth,
  addMonths,
  subMonths,
} from "@/lib/utils/date";

export function MonthSelector({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentMonth = parseMonth(searchParams.get("month"));

  function navigateToMonth(date: Date) {
    const params = new URLSearchParams(searchParams.toString());

    if (isCurrentMonth(date)) {
      params.delete("month");
    } else {
      params.set("month", formatMonthParam(date));
    }

    // Reset pagination when changing month
    if (params.has("page")) {
      params.set("page", "1");
    }

    const qs = params.toString();
    // replace, not push: the month cursor is view state of the same page — the
    // phone's back button should leave the page, not step through old months.
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  const isCurrent = isCurrentMonth(currentMonth);

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => navigateToMonth(subMonths(currentMonth, 1))}
        aria-label="Mes anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Button
        variant={isCurrent ? "secondary" : "outline"}
        size="sm"
        onClick={() => navigateToMonth(new Date())}
        className={compact ? "min-w-0 px-2 text-xs capitalize" : "min-w-[120px] sm:min-w-[160px] capitalize"}
      >
        {compact ? formatMonthLabelShort(currentMonth) : formatMonthLabel(currentMonth)}
      </Button>

      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => navigateToMonth(addMonths(currentMonth, 1))}
        aria-label="Mes siguiente"
        disabled={isCurrent}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
