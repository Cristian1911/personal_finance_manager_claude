import { connection } from "next/server";
import dynamic from "next/dynamic";
import { getUncategorizedTransactions, getUnreviewedAutoTransactions, getUserCategoryRules } from "@/actions/categorize";
import { getCategories } from "@/actions/categories";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Inbox, ShieldCheck, Tags } from "lucide-react";

const CategoryInbox = dynamic(
  () => import("@/components/categorize/category-inbox").then((m) => ({ default: m.CategoryInbox })),
  { loading: () => <div className="h-64 rounded-xl bg-muted animate-pulse" /> }
);

export default async function CategorizarPage() {
  await connection();
  const [transactions, unreviewedAutoTransactions, categoriesResult, userRules] = await Promise.all([
    getUncategorizedTransactions(),
    getUnreviewedAutoTransactions(),
    getCategories(),
    getUserCategoryRules(),
  ]);

  const categories = categoriesResult.success ? categoriesResult.data : [];
  const uncategorizedCount = transactions.length;
  const autoReviewCount = unreviewedAutoTransactions.length;
  const suggestedRulesCount = userRules.length;
  const actionCard = uncategorizedCount > 0
    ? {
        eyebrow: "Atención operativa",
        title: `${uncategorizedCount} ${uncategorizedCount === 1 ? "movimiento" : "movimientos"} todavía necesitan una decisión humana`,
        body: "Categorizar a tiempo evita que presupuesto, plan y destinatarios lean una foto incompleta del mes.",
        href: "/plan",
        cta: "Ver impacto en Plan",
      }
    : autoReviewCount > 0
      ? {
          eyebrow: "Revisión pendiente",
          title: `${autoReviewCount} ${autoReviewCount === 1 ? "auto-categorización" : "auto-categorizaciones"} esperan validación`,
          body: "La automatización ya hizo parte del trabajo. Revisa este lote para mantener el sistema confiable sin perder velocidad.",
          href: "/destinatarios",
          cta: "Ajustar reglas",
        }
      : {
          eyebrow: "Sistema estable",
          title: "La bandeja está limpia y las reglas ya sostienen el flujo",
          body: "Cuando vuelva a aparecer ruido aquí, será la señal correcta para ajustar reglas o destinatarios, no para revisar toda la app.",
          href: "/gestionar",
          cta: "Volver a Más",
        };

  return (
    <div className="space-y-6">
      <MobilePageHeader title="Categorizar" backHref="/gestionar" />

      <div className="space-y-4 lg:hidden">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
            Categorizar
          </p>
          <div>
            <h1 className="text-2xl font-semibold">Tu bandeja de orden operativo</h1>
            <p className="text-sm text-muted-foreground">
              Convierte movimientos sueltos en estructura útil para presupuesto, reglas y plan.
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
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Inbox</p>
                <p className="mt-1 text-lg font-semibold">{uncategorizedCount}</p>
              </div>
              <div className="rounded-xl border border-white/6 bg-black/10 px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Auto</p>
                <p className="mt-1 text-lg font-semibold">{autoReviewCount}</p>
              </div>
              <div className="rounded-xl border border-white/6 bg-black/10 px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Reglas</p>
                <p className="mt-1 text-lg font-semibold">{suggestedRulesCount}</p>
              </div>
            </div>
            <Button asChild className="w-full bg-z-brass text-z-ink hover:bg-z-brass/90">
              <Link href={actionCard.href}>
                {actionCard.cta}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="hidden lg:block space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
              Categorizar
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Tu bandeja de orden operativo</h1>
            <p className="text-muted-foreground">
              Asigna criterio al detalle crudo para que presupuesto, destinatarios y plan partan de una base confiable.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              className="border-white/8 bg-black/10 text-z-sage-light hover:bg-white/5 hover:text-z-sage-light"
            >
              <Link href="/destinatarios">Ver destinatarios</Link>
            </Button>
            <Button asChild className="bg-z-brass text-z-ink hover:bg-z-brass/90">
              <Link href={actionCard.href}>
                {actionCard.cta}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_24rem]">
          <Card className="border-white/6 bg-z-surface-2/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <CardHeader className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                Vista actual
              </p>
              <CardTitle className="text-2xl leading-tight">
                La categoría correcta vale más que otro gráfico bonito
              </CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">
                Esta pantalla no existe para analizar. Existe para reducir ruido y dejar el resto del sistema listo para leer tu realidad financiera con más precisión.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/6 bg-black/10 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <Inbox className="size-4 text-z-alert" />
                  Sin categoría
                </div>
                <p className="mt-2 text-2xl font-semibold">{uncategorizedCount}</p>
                <p className="mt-1 text-xs text-muted-foreground">movimientos pendientes</p>
              </div>
              <div className="rounded-2xl border border-white/6 bg-black/10 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <ShieldCheck className="size-4 text-z-brass" />
                  Auto-review
                </div>
                <p className="mt-2 text-2xl font-semibold">{autoReviewCount}</p>
                <p className="mt-1 text-xs text-muted-foreground">sugerencias por validar</p>
              </div>
              <div className="rounded-2xl border border-white/6 bg-black/10 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <Tags className="size-4 text-z-sage-dark" />
                  Reglas activas
                </div>
                <p className="mt-2 text-2xl font-semibold">{suggestedRulesCount}</p>
                <p className="mt-1 text-xs text-muted-foreground">patrones disponibles</p>
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
              <div className="rounded-2xl border border-white/6 bg-black/10 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Qué cuida esta bandeja</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Si limpias esta cola, el presupuesto deja de subestimar ruido, Plan deja de reaccionar tarde y las reglas automáticas aprenden con menos fricción.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <CategoryInbox
        initialTransactions={transactions}
        autoCategorizedTransactions={unreviewedAutoTransactions}
        categories={categories}
        userRules={userRules}
      />
    </div>
  );
}
