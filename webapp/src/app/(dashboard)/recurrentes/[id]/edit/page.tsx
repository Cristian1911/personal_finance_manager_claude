import { notFound } from "next/navigation";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { RecurringForm } from "@/components/recurring/recurring-form";
import { getRecurringTemplate } from "@/actions/recurring-templates";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { PAGE_STACK_CLASS } from "@/lib/constants/styles";

export default async function EditRecurrentePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [templateResult, accountsResult, categoriesResult] = await Promise.all([
    getRecurringTemplate(id),
    getAccounts(),
    getCategories(),
  ]);

  if (!templateResult.success) notFound();

  const template = templateResult.data;
  const accounts = accountsResult.success ? accountsResult.data : [];
  const categories = categoriesResult.success ? categoriesResult.data : [];

  return (
    <div className={PAGE_STACK_CLASS}>
      <MobileHeader
        variant="sub"
        title={`Editar ${template.merchant_name}`}
        backHref="/plan?tab=recurrentes"
      />
      <div className="px-4 pb-20">
        <RecurringForm
          template={template}
          accounts={accounts}
          categories={categories}
        />
      </div>
    </div>
  );
}
