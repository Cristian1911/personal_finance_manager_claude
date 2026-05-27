import { connection } from "next/server";
import { getSubscriptions } from "@/actions/subscriptions";
import { ensureCurrentOccurrences, getOccurrencesForMonth } from "@/actions/occurrences";
import { getPreferredCurrency } from "@/actions/profile";
import { SubscriptionsView } from "@/components/subscriptions/subscriptions-view";

export default async function SuscripcionesPage() {
  await connection();
  await ensureCurrentOccurrences();

  const [subsRes, occRes, currency] = await Promise.all([
    getSubscriptions(),
    getOccurrencesForMonth(),
    getPreferredCurrency(),
  ]);

  const subs = subsRes.success ? subsRes.data : [];
  const occurrences = occRes.success ? occRes.data : [];

  const subTemplateIds = new Set(
    subs.map((s) => s.recurring_template_id).filter(Boolean) as string[],
  );

  const authoritativeMonthly = occurrences
    .filter((o) => subTemplateIds.has(o.template_id) && o.direction === "OUTFLOW")
    .reduce((sum, o) => sum + o.expected_amount, 0);

  const estimatedMonthly = subs
    .filter((s) => !s.recurring_template_id && s.estimated_amount)
    .reduce((sum, s) => sum + (s.estimated_amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-z-sage-light">Suscripciones</h1>
      <SubscriptionsView
        subscriptions={subs}
        occurrences={occurrences}
        authoritativeMonthly={authoritativeMonthly}
        estimatedMonthly={estimatedMonthly}
        currency={currency}
      />
    </div>
  );
}
