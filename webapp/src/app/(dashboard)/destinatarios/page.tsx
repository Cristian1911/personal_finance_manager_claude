import { connection } from "next/server";
import Link from "next/link";
import { Plus, Tags } from "lucide-react";
import { getDestinatariosWithSpend, getDestinatarioSuggestions } from "@/actions/destinatarios";
import { getCategories } from "@/actions/categories";
import { getTagGroups } from "@/actions/tags";
import { getAttentionSnapshot } from "@/actions/attention";
import { CreateDestinatarioDialog } from "@/components/destinatarios/create-destinatario-dialog";
import { DestinatarioList } from "@/components/destinatarios/destinatario-list";
import { DestinatarioSuggestionsTab } from "@/components/destinatarios/destinatario-suggestions-tab";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";
import { buildCategoryMap } from "@/lib/utils/categories";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeaderRow } from "@/components/ui/page-header-row";
import { SummaryCard } from "@/components/ui/summary-card";
import { AttentionCard } from "@/components/ui/attention-card";
import { Button } from "@/components/ui/button";

export default async function DestinatariosPage() {
  await connection();
  const [destResult, catResult, suggestionsResult, tagGroupsResult, attentionSnapshot] = await Promise.all([
    getDestinatariosWithSpend(),
    getCategories(),
    getDestinatarioSuggestions(),
    getTagGroups(),
    getAttentionSnapshot(),
  ]);

  const destinatarios = destResult.success ? destResult.data : [];
  const categories = catResult.success ? catResult.data : [];
  const suggestions = suggestionsResult.success ? suggestionsResult.data : [];
  const tagGroups = tagGroupsResult.success ? tagGroupsResult.data : [];

  const categoryMap = buildCategoryMap(categories);
  const activeDestinatarios = destinatarios.filter((d) => d.is_active).length;
  const withRules = destinatarios.filter((d) => d.rule_count > 0).length;

  return (
    <div className="space-y-6">
      <MobilePageHeader title="Destinatarios" backHref="/gestionar" />

      <PageHeaderRow
        title="Destinatarios"
        subtitle={`${destinatarios.length} registrados · ${withRules} con reglas`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              className="border-white/8 bg-black/10 text-z-sage-light hover:bg-white/5 hover:text-z-sage-light"
            >
              <Link href="/categorizar">
                <Tags className="mr-2 size-4" />
                Ver Categorizar
              </Link>
            </Button>
            <CreateDestinatarioDialog
              categories={categories}
              trigger={
                <Button className="bg-z-brass text-z-ink hover:bg-z-brass/90">
                  <Plus className="mr-2 size-4" />
                  Crear destinatario
                </Button>
              }
            />
          </div>
        }
      />

      <div className="hidden lg:grid gap-4 lg:grid-cols-2">
        <SummaryCard
          label="Resumen"
          metrics={[
            { label: "Total", value: destinatarios.length, context: `${activeDestinatarios} activos` },
            { label: "Con reglas", value: withRules, context: "listos para automatizar" },
            { label: "Sugerencias", value: suggestions.length, context: "por revisar" },
          ]}
        />
        <AttentionCard
          signals={attentionSnapshot.signals.filter((s) => s.page === "destinatarios")}
        />
      </div>

      <Tabs defaultValue="destinatarios">
        <TabsList className="h-auto w-full justify-start rounded-2xl border border-white/6 bg-z-surface-2/80 p-1">
          <TabsTrigger value="destinatarios" className="rounded-xl px-4 py-2">
            Mis destinatarios
          </TabsTrigger>
          <TabsTrigger value="sugerencias" className="gap-2 rounded-xl px-4 py-2">
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
            categories={categories}
            tagGroups={tagGroups}
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
