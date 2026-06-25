import { PANEL_INSET_CLASS, PANEL_SURFACE_CLASS } from "@/lib/constants/styles";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl animate-pulse px-4">
      <div className="pt-4">
        <div className="h-3 w-16 rounded bg-white/5" />
        <div className="mt-2 h-7 w-40 rounded bg-white/5" />
      </div>

      {/* Verdict callout */}
      <div className="mt-3 h-16 rounded-2xl border border-z-brass/20 bg-z-brass/5" />

      {/* Tiles */}
      <div className="mt-2 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${PANEL_INSET_CLASS} h-20`} />
        ))}
      </div>

      {/* Period chips */}
      <div className="mt-3 flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-7 w-12 rounded-full bg-white/5" />
        ))}
      </div>

      {/* Segmented tabs */}
      <div className="mt-4 h-10 rounded-full bg-white/5" />

      {/* Card panels */}
      <div className="mt-4 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${PANEL_SURFACE_CLASS} h-40`} />
        ))}
      </div>
    </div>
  );
}
