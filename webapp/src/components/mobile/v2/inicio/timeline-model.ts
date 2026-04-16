import type {
  AttentionOverdueReminder,
  AttentionUpcomingPayment,
  AttentionPendingEmail,
} from "@/actions/attention-items";

export type TimelineUrgency = "overdue" | "today" | "future";

export type TimelineKind = "reminder" | "payment" | "emails" | "income";

export interface TimelineItem {
  id: string;
  kind: TimelineKind;
  urgency: TimelineUrgency;
  /** ISO date YYYY-MM-DD used for sorting */
  dateKey: string;
  /** Display label for the eyebrow, e.g. "Hoy · Email", "27 abr · Pago", "Vencido · 10 abr" */
  dateLabel: string;
  /** Main title shown on the card */
  title: string;
  /** Secondary line — amount or context */
  subtitle: string;
  /** When true, amount should render green with "+" */
  isIncome: boolean;
  /** Where tapping the card should route */
  href: string;
}

export interface UpcomingIncomeItem {
  occurrenceDate: string;
  amount: number;
  name: string;
}

export interface TimelineSources {
  overdueReminders: AttentionOverdueReminder[];
  upcomingPayments: AttentionUpcomingPayment[];
  pendingEmails: AttentionPendingEmail[];
  upcomingIncome: UpcomingIncomeItem[];
  /** ISO YYYY-MM-DD representing "today" in Colombia tz — passed from caller */
  todayStr: string;
}

function urgencyFor(dateKey: string, todayStr: string): TimelineUrgency {
  if (dateKey < todayStr) return "overdue";
  if (dateKey === todayStr) return "today";
  return "future";
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function shortDate(iso: string, todayStr: string): string {
  if (iso === todayStr) return "Hoy";
  const parts = iso.split("-");
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  return `${d} ${MONTHS[m - 1]}`;
}

function formatCurrencyShort(amount: number): string {
  return `$${Math.round(amount).toLocaleString("es-CO")}`;
}

export function buildTimelineItems(sources: TimelineSources): TimelineItem[] {
  const { overdueReminders, upcomingPayments, pendingEmails, upcomingIncome, todayStr } = sources;

  const items: TimelineItem[] = [];

  // Overdue reminders — each becomes its own card with explicit "Vencido · <date>" label
  for (const r of overdueReminders) {
    items.push({
      id: `reminder-${r.id}`,
      kind: "reminder",
      urgency: "overdue",
      dateKey: r.due_date,
      dateLabel: `Vencido · ${shortDate(r.due_date, todayStr)}`,
      title: r.title,
      subtitle: r.amount != null ? formatCurrencyShort(r.amount) : "",
      isIncome: false,
      href: "/gestionar",
    });
  }

  // Pending emails — collapsed into a single "N movimientos sin importar" card dated today
  if (pendingEmails.length > 0) {
    const n = pendingEmails.length;
    items.push({
      id: "emails",
      kind: "emails",
      urgency: "today",
      dateKey: todayStr,
      dateLabel: "Hoy · Email",
      title: `${n} movimiento${n === 1 ? "" : "s"} sin importar`,
      subtitle: "Revisar y confirmar",
      isIncome: false,
      href: "/gestionar",
    });
  }

  // Upcoming payments — each becomes a card
  for (const p of upcomingPayments) {
    items.push({
      id: `payment-${p.templateId}-${p.occurrenceDate}`,
      kind: "payment",
      urgency: urgencyFor(p.occurrenceDate, todayStr),
      dateKey: p.occurrenceDate,
      dateLabel: `${shortDate(p.occurrenceDate, todayStr)} · Pago`,
      title: p.name,
      subtitle: formatCurrencyShort(p.amount),
      isIncome: false,
      href: "/plan?tab=recurrentes",
    });
  }

  // Upcoming income — each becomes a card
  for (const i of upcomingIncome) {
    items.push({
      id: `income-${i.occurrenceDate}-${i.name}`,
      kind: "income",
      urgency: urgencyFor(i.occurrenceDate, todayStr),
      dateKey: i.occurrenceDate,
      dateLabel: `${shortDate(i.occurrenceDate, todayStr)} · Ingreso`,
      title: i.name,
      subtitle: `+${formatCurrencyShort(i.amount)}`,
      isIncome: true,
      href: "/plan?tab=periodo",
    });
  }

  // Sort: by date ascending, with kind as tiebreaker
  // (overdue dates < today < future dates, so date sort naturally handles urgency order)
  const kindOrder: Record<TimelineKind, number> = { reminder: 0, emails: 1, payment: 2, income: 3 };
  items.sort((a, b) => {
    if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
    return kindOrder[a.kind] - kindOrder[b.kind];
  });

  return items;
}
