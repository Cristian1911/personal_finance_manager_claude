import { connection } from "next/server";
import { getDestinatarios, getDestinatarioSuggestions } from "@/actions/destinatarios";
import { getCategories } from "@/actions/categories";
import { CreateDestinatarioDialog } from "@/components/destinatarios/create-destinatario-dialog";
import { DestinatarioList } from "@/components/destinatarios/destinatario-list";
import { DestinatarioSuggestionsTab } from "@/components/destinatarios/destinatario-suggestions-tab";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";
import { buildCategoryMap } from "@/lib/utils/categories";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { ArrowRight, Plus, Sparkles, Tags, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  const activeDestinatarios = destinatarios.filter((d) => d.is_active).length;
  const withRules = destinatarios.filter((d) => d.rule_count > 0).length;
  const actionCard = suggestions.length > 0
    ? {
        eyebrow: "Siguiente paso",
        title: `${suggestions.length} ${suggestions.length === 1 ? "patrón repetido" : "patrones repetidos"} están listos para formalizarse`,
        body: "Convierte patrones sueltos en destinatarios reutilizables para que la categorización y las reglas ganen consistencia con menos trabajo manual.",
      }
    : {
        eyebrow: "Sistema reusable",
        title: "Tus destinatarios ya están listos para sostener la automatización",
        body: "Mantén este catálogo claro y bien nombrado. Aquí vive la capa que conecta detalle crudo con reglas útiles para el resto del producto.",
      };

  return (
    <div className="space-y-6">
      <MobilePageHeader title="Destinatarios" backHref="/gestionar" />

      <div className="space-y-4 lg:hidden">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
            Destinatarios
          </p>
          <div>
            <h1 className="text-2xl font-semibold">Tu sistema de reglas reutilizables</h1>
            <p className="text-sm text-muted-foreground">
              Convierte comercios y patrones repetidos en una capa estable para categorizar mejor.
            </p>
          </div>
        </div>

        <Card className="border-white/6 bg-z-surface-2/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <CardHeader className="space-y-2 pb-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
              {actionCard.eyebrow}
            </p>
            <CardTitle className="text-lg leading-tight">{actionCard.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">{actionCard.body}</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-white/6 bg-black/10 px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Activos</p>
                <p className="mt-1 text-lg font-semibold">{activeDestinatarios}</p>
              </div>
              <div className="rounded-xl border border-white/6 bg-black/10 px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Con reglas</p>
                <p className="mt-1 text-lg font-semibold">{withRules}</p>
              </div>
              <div className="rounded-xl border border-white/6 bg-black/10 px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Sugerencias</p>
                <p className="mt-1 text-lg font-semibold">{suggestions.length}</p>
              </div>
            </div>
            <CreateDestinatarioDialog
              categories={categories}
              trigger={
                <Button className="w-full bg-z-brass text-z-ink hover:bg-z-brass/90">
                  <Plus className="size-4 mr-2" />
                  Crear destinatario
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>

      <div className="hidden lg:block space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
              Destinatarios
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Tu sistema de reglas reutilizables</h1>
            <p className="text-muted-foreground">
              Formaliza comercios, pagos y patrones repetidos para que Categorizar, Plan y el resto del workspace lean una base más confiable.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              className="border-white/8 bg-black/10 text-z-sage-light hover:bg-white/5 hover:text-z-sage-light"
            >
              <Link href="/categorizar">
                <Tags className="size-4 mr-2" />
                Ver Categorizar
              </Link>
            </Button>
            <CreateDestinatarioDialog
              categories={categories}
              trigger={
                <Button className="bg-z-brass text-z-ink hover:bg-z-brass/90">
                  <Plus className="size-4 mr-2" />
                  Crear destinatario
                </Button>
              }
            />
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_24rem]">
          <Card className="border-white/6 bg-z-surface-2/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <CardHeader className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                Vista actual
              </p>
              <CardTitle className="text-2xl leading-tight">
                Las reglas bien nombradas reducen más fricción que otra corrección manual
              </CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">
                Esta pantalla no existe para listar contactos. Existe para capturar memoria operativa: quién es quién, cómo se reconoce y qué categoría conviene aplicar por defecto.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/6 bg-black/10 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <Users className="size-4 text-z-sage-dark" />
                  Destinatarios
                </div>
                <p className="mt-2 text-2xl font-semibold">{destinatarios.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">registrados</p>
              </div>
              <div className="rounded-2xl border border-white/6 bg-black/10 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <Tags className="size-4 text-z-brass" />
                  Con reglas
                </div>
                <p className="mt-2 text-2xl font-semibold">{withRules}</p>
                <p className="mt-1 text-xs text-muted-foreground">listos para automatizar</p>
              </div>
              <div className="rounded-2xl border border-white/6 bg-black/10 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <Sparkles className="size-4 text-z-alert" />
                  Sugerencias
                </div>
                <p className="mt-2 text-2xl font-semibold">{suggestions.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">por revisar</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/6 bg-z-surface-2/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <CardHeader className="space-y-2 pb-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                {actionCard.eyebrow}
              </p>
              <CardTitle className="text-xl leading-tight">{actionCard.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-6 text-muted-foreground">{actionCard.body}</p>
              <Button asChild className="w-full justify-between bg-z-brass text-z-ink hover:bg-z-brass/90">
                <Link href="/categorizar">
                  Ver bandeja relacionada
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
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
