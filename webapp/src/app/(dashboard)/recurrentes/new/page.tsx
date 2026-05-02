import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { RecurringForm } from "@/components/recurring/recurring-form";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { MOBILE_TAB_BAR_CLEARANCE_CLASS, PAGE_STACK_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";

export default async function NewRecurrentePage() {
  const [accountsResult, categoriesResult] = await Promise.all([
    getAccounts(),
    getCategories(),
  ]);

  const accounts = accountsResult.success ? accountsResult.data : [];
  const categories = categoriesResult.success ? categoriesResult.data : [];

  return (
    <div className={PAGE_STACK_CLASS}>
      <MobileHeader variant="sub" title="Nueva recurrente" backHref="/plan?tab=recurrentes" />
      <div className={cn("px-4", MOBILE_TAB_BAR_CLEARANCE_CLASS)}>
        <RecurringForm
          accounts={accounts}
          categories={categories}
        />
      </div>
    </div>
  );
}
