export const ENVELOPE_COLORS = [
  { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/30", hex: "#60a5fa" },
  { bg: "bg-violet-500/15", text: "text-violet-400", border: "border-violet-500/30", hex: "#a78bfa" },
  { bg: "bg-teal-500/15", text: "text-teal-400", border: "border-teal-500/30", hex: "#2dd4bf" },
  { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30", hex: "#fbbf24" },
  { bg: "bg-pink-500/15", text: "text-pink-400", border: "border-pink-500/30", hex: "#f472b6" },
  { bg: "bg-cyan-500/15", text: "text-cyan-400", border: "border-cyan-500/30", hex: "#22d3ee" },
] as const;

export type EnvelopeColor = (typeof ENVELOPE_COLORS)[number];

export function getEnvelopeColor(index: number): EnvelopeColor {
  return ENVELOPE_COLORS[index % ENVELOPE_COLORS.length];
}
