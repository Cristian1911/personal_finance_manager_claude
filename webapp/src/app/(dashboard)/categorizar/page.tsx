import { getUncategorizedTransactions, getUserCategoryRules } from "@/actions/categorize";
import { getCategories } from "@/actions/categories";
import { CategoryInbox } from "@/components/categorize/category-inbox";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";

export default async function CategorizarPage() {
  const [transactions, categoriesResult, userRules] = await Promise.all([
    getUncategorizedTransactions(),
    getCategories(),
    getUserCategoryRules(),
  ]);

  const categories = categoriesResult.success ? categoriesResult.data : [];

  return (
    <div className="space-y-6">
      <MobilePageHeader title="Categorizar" backHref="/categories" />
      <div className="hidden lg:block">
        <h1 className="text-2xl font-bold">Categorizar</h1>
        <p className="text-muted-foreground">
          Asigna categorías a tus transacciones para un mejor control de tus
          finanzas.
        </p>
      </div>
      <CategoryInbox
        initialTransactions={transactions}
        categories={categories}
        userRules={userRules}
      />
    </div>
  );
}
