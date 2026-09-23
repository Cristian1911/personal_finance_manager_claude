import { connection } from "next/server";
import { getPersonalDebtsByPerson } from "@/actions/personal-debts";
import { overviewFromHierarchy } from "@/lib/personal-debts/hierarchy";
import { getPreferredCurrency } from "@/actions/profile";
import { PersonasRoot } from "@/components/personas/personas-root";
import { NewDebtMenu } from "@/components/personas/new-debt-menu";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { PageHeaderRow } from "@/components/ui/page-header-row";
import { MOBILE_TAB_BAR_CLEARANCE_CLASS, PAGE_STACK_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";

export default async function PersonasPage({
  searchParams,
}: {
  searchParams: Promise<{ persona?: string }>;
}) {
  await connection();
  const { persona } = await searchParams;
  const currency = await getPreferredCurrency();
  const peopleRes = await getPersonalDebtsByPerson(currency);
  const people = peopleRes.success ? peopleRes.data : [];
  const overview = overviewFromHierarchy(people);

  return (
    <div className={cn(PAGE_STACK_CLASS, MOBILE_TAB_BAR_CLEARANCE_CLASS)}>
      <MobileHeader
        variant="main"
        title="Deudas personales"
        action={<NewDebtMenu currency={currency} compact />}
      />
      <PageHeaderRow
        title="Deudas personales"
        subtitle="Quién te debe y a quién le debes, por persona y por viaje."
        actions={<NewDebtMenu currency={currency} />}
      />
      <div className="mx-auto w-full max-w-3xl">
        <PersonasRoot people={people} overview={overview} currency={currency} focusId={persona ?? null} />
      </div>
    </div>
  );
}
