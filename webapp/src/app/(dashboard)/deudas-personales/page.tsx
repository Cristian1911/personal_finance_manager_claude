import { connection } from "next/server";
import { getPersonalDebts, getPersonalDebtsOverview } from "@/actions/personal-debts";
import { getPreferredCurrency } from "@/actions/profile";
import { PersonasRoot } from "@/components/personas/personas-root";
import { MOBILE_TAB_BAR_CLEARANCE_CLASS } from "@/lib/constants/styles";

export default async function PersonasPage() {
  await connection();
  const [debtsRes, overviewRes, currency] = await Promise.all([
    getPersonalDebts(),
    getPersonalDebtsOverview(),
    getPreferredCurrency(),
  ]);
  const debts = debtsRes.success ? debtsRes.data : [];
  const overview = overviewRes.success
    ? overviewRes.data
    : { iOwe: { total: 0, byPerson: [] }, owedToMe: { total: 0, byPerson: [] }, overdue: [] };
  return (
    <div className={`space-y-6 ${MOBILE_TAB_BAR_CLEARANCE_CLASS}`}>
      <h1 className="text-2xl font-semibold tracking-tight text-z-sage-light lg:text-3xl">
        Deudas personales
      </h1>
      <PersonasRoot debts={debts} overview={overview} currency={currency} />
    </div>
  );
}
