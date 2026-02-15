import { getCategories } from "@/actions/categories";
import { CategoryList } from "@/components/categories/category-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function CategoriesPage() {
  const [outflowResult, inflowResult] = await Promise.all([
    getCategories("OUTFLOW"),
    getCategories("INFLOW"),
  ]);

  const outflowCategories = outflowResult.success ? outflowResult.data : [];
  const inflowCategories = inflowResult.success ? inflowResult.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Categorías</h1>
        <p className="text-muted-foreground">
          Gestiona las categorías para clasificar tus transacciones
        </p>
      </div>

      <Tabs defaultValue="outflow">
        <TabsList>
          <TabsTrigger value="outflow">Gastos</TabsTrigger>
          <TabsTrigger value="inflow">Ingresos</TabsTrigger>
        </TabsList>

        <TabsContent value="outflow" className="mt-4">
          <div className="rounded-lg border bg-card">
            <CategoryList categories={outflowCategories} />
          </div>
        </TabsContent>

        <TabsContent value="inflow" className="mt-4">
          <div className="rounded-lg border bg-card">
            <CategoryList categories={inflowCategories} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
