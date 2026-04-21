type Props = { label: string };

export function SectionDivider({ label }: Props) {
  return (
    <div className="my-3 flex items-center gap-3">
      <div className="h-px flex-1 bg-white/6" />
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
        {label}
      </span>
      <div className="h-px flex-1 bg-white/6" />
    </div>
  );
}
