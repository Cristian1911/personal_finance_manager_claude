interface SectionDividerProps {
  label: string;
}

export function SectionDivider({ label }: SectionDividerProps) {
  return (
    <div className="flex items-center gap-2 px-0.5 py-1">
      <span aria-hidden className="h-px flex-1 bg-white/6" />
      <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
        {label}
      </span>
      <span aria-hidden className="h-px flex-1 bg-white/6" />
    </div>
  );
}
