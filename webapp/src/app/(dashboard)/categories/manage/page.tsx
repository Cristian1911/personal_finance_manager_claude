import { getCategoriesWithBudgets } from "@/actions/categories";
import { CategoryManageTree } from "@/components/categories/category-manage-tree";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function CategoryManagePage() {
  const [outflowResult, inflowResult] = await Promise.all([
    getCategoriesWithBudgets("OUTFLOW"),
    getCategoriesWithBudgets("INFLOW"),
  ]);

  const outflow = outflowResult.success ? outflowResult.data : [];
  const inflow = inflowResult.success ? inflowResult.data : [];
  const allCategories = [...outflow, ...inflow];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/categories">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Gestionar categorías</h1>
          <p className="text-muted-foreground text-sm">
            Crea, edita y elimina categorías. Los presupuestos de grupos se calculan automáticamente.
          </p>
        </div>
      </div>

      {allCategories.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No hay categorías activas.</p>
      ) : (
        <CategoryManageTree categories={allCategories} />
      )}
    </div>
  );
}
