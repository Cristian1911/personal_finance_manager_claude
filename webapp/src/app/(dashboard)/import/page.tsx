import { connection } from "next/server";
import Link from "next/link";
import { ArrowRight, Files, ShieldCheck, Sparkles } from "lucide-react";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { getDestinatarioRules } from "@/actions/destinatarios";
import { ImportWizard } from "@/components/import/import-wizard";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";
import { Button } from "@/components/ui/button";
import { PageHero, HeroPill, HeroAccentPill } from "@/components/ui/page-hero";
import { StatCard } from "@/components/ui/stat-card";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";

export default async function ImportPage() {
  await connection();
  const [accountResult, categoryResult, rulesResult] = await Promise.all([
    getAccounts(),
    getCategories(),
    getDestinatarioRules(),
  ]);
  const accounts = accountResult.success ? accountResult.data : [];
  const categories = categoryResult.success ? categoryResult.data : [];
  const destinatarioRules = rulesResult.success ? rulesResult.data : [];

  return (
    <div className="space-y-6 lg:space-y-8">
      <MobilePageHeader title="Importar Extracto" backHref="/gestionar" />

      <PageHero
        variant="brass"
        pills={<><HeroPill>Actualizar base</HeroPill><HeroAccentPill>Flujo guiado</HeroAccentPill></>}
        title="Importa el extracto y devuelve contexto a toda la app"
        description="Este flujo trae movimientos, actualiza saldos, aprende destinatarios y te ayuda a reconciliar duplicados antes de que la foto diaria se quede vieja."
        actions={
          <>
            <Button asChild className={BRASS_BUTTON_CLASS}>
              <Link href="/accounts">
                Revisar cuentas
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className={GHOST_BUTTON_CLASS}>
              <Link href="/destinatarios">Afinar destinatarios</Link>
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Cuentas listas"
            value={accounts.length}
            description="Bases disponibles para asociar cada extracto al destino correcto."
          />
          <StatCard
            label="Categorías activas"
            value={categories.length}
            description="Se usarán para preparar la revisión y la confirmación final."
          />
          <StatCard
            label="Reglas aprendidas"
            value={destinatarioRules.length}
            description="Atajos ya disponibles para reconocer comercios y sugerir categorías."
          />
          <StatCard
            label={
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                <ShieldCheck className="size-4 text-z-brass" />
                Lo que protege el flujo
              </div>
            }
            value={
              <span className="text-sm font-normal leading-6 text-muted-foreground">
                Revisión manual de cuenta, destinatarios y conciliación antes de escribir en la base.
              </span>
            }
          />
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="rounded-2xl border border-white/6 bg-z-surface-2/55 p-4">
            <div className="flex items-start gap-3">
              <Files className="mt-0.5 size-4 text-z-brass" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-z-white">Qué resuelve este flujo</p>
                <p className="text-sm text-muted-foreground">
                  Sube el PDF, confirma la cuenta correcta, aprende destinatarios, revisa
                  transacciones y resuelve duplicados antes de cerrar la importación.
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/6 bg-z-surface-2/55 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 size-4 text-z-brass" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-z-white">Si no tienes cuentas aún</p>
                <p className="text-sm text-muted-foreground">
                  Puedes crear una durante la revisión. No hace falta salir de este flujo para
                  empezar.
                </p>
              </div>
            </div>
          </div>
        </div>
      </PageHero>

      <ImportWizard
        accounts={accounts}
        categories={categories}
        destinatarioRules={destinatarioRules}
      />
    </div>
  );
}
