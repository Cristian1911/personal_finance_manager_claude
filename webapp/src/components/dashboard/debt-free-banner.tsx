import { parse, format } from "date-fns";
import { es } from "date-fns/locale";
import type { DebtCountdownData } from "@/actions/debt-countdown";

interface DebtFreeBannerProps {
  data: DebtCountdownData | null;
}

export function DebtFreeBanner({ data }: DebtFreeBannerProps) {
  if (!data) return null;

  const parsedDate = parse(data.projectedDate, "yyyy-MM", new Date());
  const formattedDate = format(parsedDate, "MMM yyyy", { locale: es });
  // Capitalize first letter (date-fns es locale returns lowercase)
  const displayDate =
    formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  const copy = `Libre de deudas: ${displayDate} (${data.monthsToFree} meses)`;

  return (
    <div
      className="animate-in fade-in duration-150 mt-3 rounded-lg px-4 py-3 border"
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--z-income) 8%, transparent)",
        borderColor:
          "color-mix(in srgb, var(--z-income) 20%, transparent)",
        color: "var(--z-income)",
      }}
    >
      <p className="text-sm font-medium">{copy}</p>
    </div>
  );
}

export function DebtFreeBannerSkeleton() {
  return (
    <div className="mt-3 h-10 w-full rounded-lg bg-z-surface-3 animate-pulse" />
  );
}
