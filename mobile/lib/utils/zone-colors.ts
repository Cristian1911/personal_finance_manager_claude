/**
 * Port of webapp/src/lib/utils/zone-colors.ts for RN.
 * Produces rgba() strings from hex zone colors.
 */

const FALLBACK = { r: 107, g: 114, b: 128 };

function parseHex(hex: string | null | undefined): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  const match = hex.match(/^#([0-9a-f]{3,8})$/i);
  if (!match) return null;
  const h = match[1];
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  if (h.length >= 6) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  return null;
}

function rgba(hex: string | null | undefined, alpha: number): string {
  const c = parseHex(hex) ?? FALLBACK;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
}

export function zoneBackground(hex: string | null | undefined): string {
  return rgba(hex, 0.1);
}

export function zoneBorder(hex: string | null | undefined): string {
  return rgba(hex, 0.2);
}

export function chipBackground(hex: string | null | undefined): string {
  return rgba(hex, 0.15);
}

export function zoneTextColor(hex: string | null | undefined): string {
  return parseHex(hex) ? (hex as string) : `rgb(${FALLBACK.r}, ${FALLBACK.g}, ${FALLBACK.b})`;
}
