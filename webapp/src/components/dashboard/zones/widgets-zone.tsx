import { getRecentImpactEvents } from "@/actions/impact-events";
import { getReminders } from "@/actions/reminders";
import { RecentImpactsWidget } from "@/components/impact/recent-impacts-widget";
import { PendientesWidget } from "@/components/reminders/pendientes-widget";

export async function WidgetsZone() {
  const [impactEvents, pendingReminders, completedReminders] = await Promise.all([
    getRecentImpactEvents(3),
    getReminders("pending"),
    getReminders("completed"),
  ]);

  const recentCompletedReminders = completedReminders.slice(0, 10);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <RecentImpactsWidget events={impactEvents} />
      <PendientesWidget
        reminders={pendingReminders}
        completedReminders={recentCompletedReminders}
      />
    </div>
  );
}
