import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { getDestinatarioRules, getUnmatchedDescriptions } from "@/actions/destinatarios";
import { ImportWizard } from "@/components/import/import-wizard";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";

export default async function ImportPage() {
  const [accountResult, categoryResult, rulesResult, unmatchedResult] = await Promise.all([
    getAccounts(),
    getCategories(),
    getDestinatarioRules(),
    getUnmatchedDescriptions(),
  ]);
  const accounts = accountResult.success ? accountResult.data : [];
  const categories = categoryResult.success ? categoryResult.data : [];
  const destinatarioRules = rulesResult.success ? rulesResult.data : [];
  const unmatchedDescriptions = unmatchedResult.success ? unmatchedResult.data : [];

  return (
    <div className="space-y-6">
      <MobilePageHeader title="Importar Extracto" backHref="/gestionar" />
      <div className="hidden lg:block">
        <h1 className="text-2xl font-bold">Importar Extracto</h1>
        <p className="text-muted-foreground">
          Sube un extracto bancario en PDF para importar tus transacciones
        </p>
      </div>
      <ImportWizard
        accounts={accounts}
        categories={categories}
        destinatarioRules={destinatarioRules}
        unmatchedDescriptions={unmatchedDescriptions}
      />
    </div>
  );
}
