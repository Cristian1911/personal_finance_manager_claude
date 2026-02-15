import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { ImportWizard } from "@/components/import/import-wizard";

export default async function ImportPage() {
  const [accountResult, categoryResult] = await Promise.all([
    getAccounts(),
    getCategories(),
  ]);
  const accounts = accountResult.success ? accountResult.data : [];
  // Flatten category tree to a flat list for the import wizard
  const categories = categoryResult.success
    ? categoryResult.data.flatMap((cat) => [cat, ...cat.children])
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Importar Extracto</h1>
        <p className="text-muted-foreground">
          Sube un extracto bancario en PDF para importar tus transacciones
        </p>
      </div>
      <ImportWizard accounts={accounts} categories={categories} />
    </div>
  );
}
