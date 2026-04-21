import { connection } from "next/server";
import { getPreferredCurrency } from "@/actions/profile";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { AffordPageClient } from "@/components/afford/afford-page-client";
import { formatMonthParam } from "@/lib/utils/date";

export const metadata = {
  title: "¿Debería comprar esto? · Zeta",
};

export default async function PuedoPagarPage() {
  await connection();

  const preferredCurrency = await getPreferredCurrency();
  const defaultMonth = formatMonthParam(new Date());

  return (
    <>
      <MobileHeader variant="sub" title="¿Debería comprar esto?" backHref="/dashboard" />
      <AffordPageClient
        defaultMonth={defaultMonth}
        defaultCurrency={preferredCurrency}
      />
    </>
  );
}
