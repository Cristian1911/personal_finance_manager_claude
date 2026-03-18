import { connection } from "next/server";
import { getDestinatarios, getDestinatarioSuggestions } from "@/actions/destinatarios";
import { getCategories } from "@/actions/categories";
import { DestinatarioList } from "@/components/destinatarios/destinatario-list";
import { DestinatarioSuggestionsTab } from "@/components/destinatarios/destinatario-suggestions-tab";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";
import { buildCategoryMap } from "@/lib/utils/categories";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function DestinatariosPage() {
  await connection();
  const [destResult, catResult, suggestionsResult] = await Promise.all([
    getDestinatarios(),
    getCategories(),
    getDestinatarioSuggestions(),
  ]);

  const destinatarios = destResult.success ? destResult.data : [];
  const categories = catResult.success ? catResult.data : [];
  const suggestions = suggestionsResult.success ? suggestionsResult.data : [];

  const categoryMap = buildCategoryMap(categories);

  return (
    <div className="space-y-6">
      <MobilePageHeader title="Destinatarios" backHref="/gestionar" />
      <div className="hidden lg:flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Destinatarios</h1>
          <p className="text-muted-foreground">
            {destinatarios.length} destinatario{destinatarios.length !== 1 ? "s" : ""} registrado{destinatarios.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button asChild>
          <Link href="/destinatarios/nuevo">
            <Plus className="size-4 mr-2" />
            Crear destinatario
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="destinatarios">
        <TabsList>
          <TabsTrigger value="destinatarios">Mis destinatarios</TabsTrigger>
          <TabsTrigger value="sugerencias" className="gap-2">
            Sugerencias
            {suggestions.length > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
                {suggestions.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="destinatarios" className="mt-4">
          <DestinatarioList
            destinatarios={destinatarios}
            categoryMap={categoryMap}
          />
        </TabsContent>

        <TabsContent value="sugerencias" className="mt-4">
          <DestinatarioSuggestionsTab
            suggestions={suggestions}
            categories={categories}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
