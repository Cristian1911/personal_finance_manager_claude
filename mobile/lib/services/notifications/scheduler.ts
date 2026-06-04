import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { getPendingOccurrences } from "../../repositories/recurring";
import { isPaymentRemindersEnabled } from "./preferences";
import { getNotificationPermission } from "./permissions";

const ANDROID_CHANNEL_ID = "payment-reminders";
/** Local hour (24h) at which the day-before reminder fires. */
const REMINDER_HOUR = 18;
/** Only remind for occurrences due within this many days. */
const HORIZON_DAYS = 14;
/** Cap so a user with many recurrentes doesn't flood the OS scheduler. */
const MAX_SCHEDULED = 30;

let handlerConfigured = false;
let rescheduling = false;

/**
 * Configure how notifications surface while the app is foregrounded. Call once
 * at app start. Idempotent.
 */
export function configureNotificationHandler(): void {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "Recordatorios de pago",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
  });
}

/**
 * Reminder fire time: the day BEFORE the occurrence, at REMINDER_HOUR local.
 * `occurrence_date` is a "YYYY-MM-DD" string — parse the parts into a LOCAL
 * Date (never `new Date("YYYY-MM-DD")`, which is UTC midnight → wrong day in
 * Colombia UTC-5).
 */
function reminderDateFor(occurrenceDate: string): Date | null {
  const parts = occurrenceDate.split("-").map((n) => parseInt(n, 10));
  const [y, m, d] = parts;
  if (!y || !m || !d) return null;
  const reminder = new Date(y, m - 1, d, REMINDER_HOUR, 0, 0, 0);
  reminder.setDate(reminder.getDate() - 1);
  return reminder;
}

function occurrenceLocalDate(occurrenceDate: string): Date | null {
  const parts = occurrenceDate.split("-").map((n) => parseInt(n, 10));
  const [y, m, d] = parts;
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/**
 * Cancel every scheduled reminder and re-schedule from the CURRENT set of
 * pending occurrences. Safe to call on every app open / after each sync — it is
 * the single source of truth, so paid/skipped/changed bills self-correct.
 *
 * No-ops (after clearing) if the user hasn't opted in or hasn't granted the OS
 * permission. All errors are swallowed: reminders are best-effort, never a
 * blocking failure.
 */
export async function reschedulePaymentReminders(): Promise<void> {
  // Drop overlapping runs: this fires from both the post-sync hook (auth.tsx)
  // and the app-foreground listener (_layout.tsx), which can race on a
  // cold-start-foreground and interleave their cancel/schedule calls.
  if (rescheduling) return;
  rescheduling = true;
  try {
    // Clear ours first so cancelled/paid bills never linger. This app schedules
    // no other local notifications, so cancel-all is equivalent to cancel-ours.
    await Notifications.cancelAllScheduledNotificationsAsync();

    if (!(await isPaymentRemindersEnabled())) return;
    if (!(await getNotificationPermission())) return;

    await ensureAndroidChannel();

    const now = new Date();
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + HORIZON_DAYS);

    const occurrences = await getPendingOccurrences();
    let scheduled = 0;

    for (const occ of occurrences) {
      if (scheduled >= MAX_SCHEDULED) break;

      const reminder = reminderDateFor(occ.occurrence_date);
      if (!reminder || reminder <= now) continue; // reminder time already passed

      const occDate = occurrenceLocalDate(occ.occurrence_date);
      if (!occDate || occDate > horizon) continue; // outside the horizon

      const label = occ.merchant_name || occ.description || "Pago programado";
      const amount = formatCurrency(
        occ.expected_amount,
        (occ.currency_code as CurrencyCode) || "COP",
      );

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `💸 Mañana vence ${label}`,
          body: amount,
          data: { route: "/pendientes", occurrenceId: occ.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminder,
          ...(Platform.OS === "android"
            ? { channelId: ANDROID_CHANNEL_ID }
            : {}),
        },
      });
      scheduled += 1;
    }
  } catch (err) {
    if (__DEV__) console.warn("reschedulePaymentReminders failed:", err);
  } finally {
    rescheduling = false;
  }
}
