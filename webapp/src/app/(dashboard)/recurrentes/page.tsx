import { connection } from "next/server";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { MobileRecurringManager } from "@/components/recurring/mobile-recurring-manager";
import { getRecurringTemplates } from "@/actions/recurring-templates";
import { getAccounts } from "@/actions/accounts";
import { getPreferredCurrency } from "@/actions/profile";
import { ensureCurrentOccurrences } from "@/actions/occurrences";
import { PAGE_STACK_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode } from "@/types/domain";

export default async function RecurrentesPage() {
  await connection();
  await ensureCurrentOccurrences();

  const [templatesResult, accountsResult, currency] = await Promise.all([
    getRecurringTemplates(),
    getAccounts(),
    getPreferredCurrency(),
  ]);

  const templates = templatesResult.success ? templatesResult.data : [];
  const accounts = accountsResult.success ? accountsResult.data : [];

  return (
    <div className={PAGE_STACK_CLASS}>
      <MobileHeader variant="sub" title="Recurrentes" backHref="/plan" />
      <MobileRecurringManager
        templates={templates}
        accounts={accounts}
        currency={currency as CurrencyCode}
      />
    </div>
  );
}
