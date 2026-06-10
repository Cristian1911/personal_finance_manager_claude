"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Square bank badge for account rows. Tries the official logo from
 * `/public/banks/<key>.png` first; while the asset doesn't exist it falls
 * back to a brand-colored monogram. Drop official logos into
 * `webapp/public/banks/` (32×32+, png) and they're picked up automatically.
 */

interface BankBrand {
  key: string;
  /** Monogram letter(s) */
  mono: string;
  /** Brand background color (official palette) */
  bg: string;
  /** Monogram text color */
  fg: string;
}

const BRANDS: { match: RegExp; brand: BankBrand }[] = [
  { match: /bancolombia/i, brand: { key: "bancolombia", mono: "B", bg: "#FDDA24", fg: "#2C2A29" } },
  { match: /\bnu\b|nubank/i, brand: { key: "nu", mono: "nu", bg: "#820AD1", fg: "#FFFFFF" } },
  { match: /davivienda/i, brand: { key: "davivienda", mono: "D", bg: "#ED1C27", fg: "#FFFFFF" } },
  { match: /nequi/i, brand: { key: "nequi", mono: "N", bg: "#200020", fg: "#FF2F73" } },
  { match: /falabella/i, brand: { key: "falabella", mono: "F", bg: "#007A33", fg: "#FFFFFF" } },
  { match: /bogot[aá]/i, brand: { key: "banco-bogota", mono: "B", bg: "#002B7F", fg: "#FFFFFF" } },
  { match: /lulo/i, brand: { key: "lulo", mono: "L", bg: "#E2FF32", fg: "#1A1A1A" } },
  { match: /confiar/i, brand: { key: "confiar", mono: "C", bg: "#00843D", fg: "#FFFFFF" } },
  { match: /popular/i, brand: { key: "banco-popular", mono: "P", bg: "#FFD100", fg: "#1A1A1A" } },
  { match: /bbva/i, brand: { key: "bbva", mono: "B", bg: "#072146", fg: "#FFFFFF" } },
  { match: /scotiabank|colpatria/i, brand: { key: "scotiabank", mono: "S", bg: "#EC111A", fg: "#FFFFFF" } },
];

function resolveBrand(name: string, institutionName?: string | null): BankBrand | null {
  const haystack = `${institutionName ?? ""} ${name}`;
  for (const { match, brand } of BRANDS) {
    if (match.test(haystack)) return brand;
  }
  return null;
}

// Shared across instances so a missing logo is only requested once per bank.
const failedLogos = new Set<string>();

export function BankBadge({
  name,
  institutionName,
  className,
}: {
  name: string;
  institutionName?: string | null;
  className?: string;
}) {
  const brand = resolveBrand(name, institutionName);
  const [logoFailed, setLogoFailed] = useState(() =>
    brand ? failedLogos.has(brand.key) : true
  );

  if (brand && !logoFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 32px static asset with monogram fallback; next/image adds no value here
      <img
        src={`/banks/${brand.key}.png`}
        alt={brand.key}
        width={32}
        height={32}
        onError={() => {
          failedLogos.add(brand.key);
          setLogoFailed(true);
        }}
        className={cn("size-8 shrink-0 rounded-lg border border-white/6 object-cover", className)}
      />
    );
  }

  const mono = brand?.mono ?? name.charAt(0).toUpperCase();
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/6 text-[13px] font-bold",
        !brand && "bg-z-surface-3 text-z-sage-light",
        className
      )}
      style={brand ? { background: brand.bg, color: brand.fg } : undefined}
    >
      {mono}
    </span>
  );
}
