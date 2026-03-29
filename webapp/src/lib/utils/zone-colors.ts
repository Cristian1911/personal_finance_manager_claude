const FALLBACK = { r: 107, g: 114, b: 128 }; // gray-500

function parseHex(hex: string): { r: number; g: number; b: number } | null {
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

function rgba(hex: string, alpha: number): string {
  const c = parseHex(hex) ?? FALLBACK;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
}

/** Zone tile background — 10% opacity of zone color */
export function zoneBackground(hex: string): string {
  return rgba(hex, 0.1);
}

/** Zone tile border — 20% opacity of zone color */
export function zoneBorder(hex: string): string {
  return rgba(hex, 0.2);
}

/** Subcategory chip background — 15% opacity of zone color */
export function chipBackground(hex: string): string {
  return rgba(hex, 0.15);
}

/** Zone text color — uses the category color directly (suitable for dark theme) */
export function zoneTextColor(hex: string): string {
  return parseHex(hex)
    ? hex
    : `rgb(${FALLBACK.r}, ${FALLBACK.g}, ${FALLBACK.b})`;
}
