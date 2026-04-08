import { getRecentImpactEvents } from "@/actions/impact-events";
import { getReminders } from "@/actions/reminders";
import {
  getWishlistItemsForDashboard,
  getActiveNudges as getWishlistNudges,
} from "@/actions/wishlist";
import { RecentImpactsWidget } from "@/components/impact/recent-impacts-widget";
import { PendientesWidget } from "@/components/reminders/pendientes-widget";
import { DeseosWidget } from "@/components/dashboard/deseos-widget";

export async function WidgetsZone() {
  const [impactEvents, pendingReminders, completedReminders, wishlistDashboard, wishlistNudges] =
    await Promise.all([
      getRecentImpactEvents(3),
      getReminders("pending"),
      getReminders("completed"),
      getWishlistItemsForDashboard(),
      getWishlistNudges(),
    ]);

  const recentCompletedReminders = completedReminders.slice(0, 10);

  return (
    <>
      {/* Impact + Pendientes */}
      <div className="grid gap-4 xl:grid-cols-2">
        <RecentImpactsWidget events={impactEvents} />
        <PendientesWidget
          reminders={pendingReminders}
          completedReminders={recentCompletedReminders}
        />
      </div>

      {/* Deseos */}
      <DeseosWidget
        items={wishlistDashboard.items}
        totalCount={wishlistDashboard.totalCount}
        readyCount={wishlistDashboard.readyCount}
        nudge={wishlistNudges[0] ?? null}
      />
    </>
  );
}
