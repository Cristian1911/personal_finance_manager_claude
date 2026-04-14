import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { RecurringForm } from "@/components/recurring/recurring-form";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { PAGE_STACK_CLASS } from "@/lib/constants/styles";

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
      <div className="px-4 pb-20">
        <RecurringForm
          accounts={accounts}
          categories={categories}
        />
      </div>
    </div>
  );
}
