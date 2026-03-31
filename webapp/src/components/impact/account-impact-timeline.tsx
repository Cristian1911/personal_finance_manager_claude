import { ImpactEventCard } from "./impact-event-card";
import type { ImpactEvent } from "@/types/domain";

interface AccountImpactTimelineProps {
  events: ImpactEvent[];
}

export function AccountImpactTimeline({ events }: AccountImpactTimelineProps) {
  if (events.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Historial de impacto
      </h3>
      <div className="space-y-2">
        {events.map((event, i) => (
          <ImpactEventCard key={`${event.accountId}-${event.date}-${i}`} event={event} />
        ))}
      </div>
    </div>
  );
}
