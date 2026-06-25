"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CHIP_NEUTRAL_CLASS } from "@/lib/constants/styles";

const RANGES = ["3M", "6M", "12M", "YTD"] as const;
const ACTIVE_CHIP =
  "shrink-0 rounded-full border border-z-brass/25 bg-z-brass/10 px-3 py-1.5 text-xs font-medium text-z-brass";

export function PeriodControl({ range }: { range: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setRange(r: string) {
    const next = new URLSearchParams(params);
    next.set("range", r);
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="mt-3 flex gap-2 overflow-x-auto">
      {RANGES.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => setRange(r)}
          className={range === r ? ACTIVE_CHIP : `${CHIP_NEUTRAL_CLASS} shrink-0 text-z-sage-dark`}
        >
          {r === "YTD" ? "Año" : r}
        </button>
      ))}
    </div>
  );
}
