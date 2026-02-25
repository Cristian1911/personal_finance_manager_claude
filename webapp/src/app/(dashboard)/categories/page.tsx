import { getCategories } from "@/actions/categories";
import { getBudgets } from "@/actions/budgets";
import { SortableCategoryList } from "@/components/categories/sortable-category-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";

export default async function CategoriesPage() {
  const [outflowResult, inflowResult, budgetsResult] = await Promise.all([
    getCategories("OUTFLOW"),
    getCategories("INFLOW"),
    getBudgets(),
  ]);

  const outflowCategories = outflowResult.success ? outflowResult.data : [];
  const inflowCategories = inflowResult.success ? inflowResult.data : [];
  const budgets = budgetsResult.success ? budgetsResult.data : [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categorías y Presupuestos</h1>
          <p className="text-muted-foreground">
            Gestiona tus categorías y establece metas de presupuesto mensual
          </p>
        </div>
        <Link href="/categories/manage">
          <Button variant="outline" size="sm" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Gestionar
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="outflow">
        <TabsList>
          <TabsTrigger value="outflow">Gastos</TabsTrigger>
          <TabsTrigger value="inflow">Ingresos</TabsTrigger>
        </TabsList>

        <TabsContent value="outflow" className="mt-4">
          <SortableCategoryList initialCategories={outflowCategories} budgets={budgets} />
        </TabsContent>

        <TabsContent value="inflow" className="mt-4">
          <SortableCategoryList initialCategories={inflowCategories} budgets={budgets} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
