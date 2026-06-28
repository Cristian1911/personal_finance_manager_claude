import { connection } from "next/server";
import { getAllCategoriesForManagement } from "@/actions/categories";
import { CategoryZoneManager } from "@/components/categories/category-zone-manager";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { PageHeaderRow } from "@/components/ui/page-header-row";
import { MOBILE_TAB_BAR_CLEARANCE_CLASS } from "@/lib/constants/styles";

export default async function CategoriesPage() {
  await connection();

  const manageResult = await getAllCategoriesForManagement();
  const categories = manageResult.success ? manageResult.data : [];

  return (
    <div className={`space-y-6 lg:space-y-8 ${MOBILE_TAB_BAR_CLEARANCE_CLASS}`}>
      <MobileHeader variant="sub" title="Categorías" backHref="/plan" />

      <PageHeaderRow
        title="Categorías"
        subtitle="Crea, edita y organiza tus categorías y subcategorías"
        className="hidden lg:flex"
      />

      <CategoryZoneManager categories={categories} />
    </div>
  );
}
