import { cn } from "@/lib/utils";
import { SECTION_EYEBROW_CLASS } from "@/lib/constants/styles";

interface SettingsSectionProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function SettingsSection({ label, children, className }: SettingsSectionProps) {
  return (
    <section className={cn("space-y-2", className)}>
      <div className="flex items-center gap-3">
        <span className={SECTION_EYEBROW_CLASS}>{label}</span>
        <div className="h-px flex-1 bg-white/6" />
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
