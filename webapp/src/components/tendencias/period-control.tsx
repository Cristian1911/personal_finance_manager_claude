"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const RANGES = ["3M", "6M", "12M", "YTD"] as const;

export function PeriodControl({ range }: { range: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setRange(r: string) {
    const next = new URLSearchParams(params);
    next.set("range", r);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="mt-3 flex gap-2 overflow-x-auto">
      {RANGES.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => setRange(r)}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            range === r
              ? "border-z-brass/25 bg-z-brass/10 text-z-brass"
              : "border-white/6 bg-white/3 text-z-sage-dark hover:text-z-sage-light"
          }`}
        >
          {r === "YTD" ? "Año" : r}
        </button>
      ))}
    </div>
  );
}
