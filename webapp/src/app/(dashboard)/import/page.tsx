import { connection } from "next/server";
import Link from "next/link";
import { ArrowRight, ChevronDown, Files, ShieldCheck, Sparkles } from "lucide-react";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { getDestinatarioRules } from "@/actions/destinatarios";
import { getPendingEmailStatements } from "@/actions/email-pdf-ingest";
import { suggestPdfPasswordsForAccount } from "@/actions/pdf-passwords";
import { ImportPageClient } from "@/components/import/import-page-client";
import { Button } from "@/components/ui/button";
import { PageHero, HeroPill, HeroAccentPill } from "@/components/ui/page-hero";
import { StatCard } from "@/components/ui/stat-card";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";

export default async function ImportPage() {
  await connection();
  const [accountResult, categoryResult, rulesResult, pendingStatementsResult, vaultSuggestions] = await Promise.all([
    getAccounts(),
    getCategories(),
    getDestinatarioRules(),
    getPendingEmailStatements(),
    suggestPdfPasswordsForAccount(null, null),
  ]);
  const accounts = accountResult.success ? accountResult.data : [];
  const categories = categoryResult.success ? categoryResult.data : [];
  const destinatarioRules = rulesResult.success ? rulesResult.data : [];
  const pendingStatements = pendingStatementsResult.success ? pendingStatementsResult.data : [];

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Mobile header is rendered inside ImportPageClient so it can react to
          wizard step state (back arrow → X once the user has committed). */}

      {/* Desktop: full PageHero */}
      <div className="hidden lg:block">
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
      </div>

      <ImportPageClient
        accounts={accounts}
        categories={categories}
        destinatarioRules={destinatarioRules}
        pendingStatements={pendingStatements}
        initialVaultSuggestions={vaultSuggestions}
        mobileAboutPanel={
          <details className="group lg:hidden rounded-2xl border border-white/6 bg-z-surface-2/55">
            <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-z-sage-light marker:content-none [&::-webkit-details-marker]:hidden">
              Más sobre este flujo
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-3 px-4 pb-4">
              <div className="grid gap-3 grid-cols-2">
                <StatCard
                  label="Cuentas listas"
                  value={accounts.length}
                  description="Bases disponibles para asociar cada extracto."
                />
                <StatCard
                  label="Categorías activas"
                  value={categories.length}
                  description="Para revisión y confirmación final."
                />
                <StatCard
                  label="Reglas aprendidas"
                  value={destinatarioRules.length}
                  description="Atajos para reconocer comercios."
                />
                <StatCard
                  label={
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                      <ShieldCheck className="size-4 text-z-brass" />
                      Protección
                    </div>
                  }
                  value={
                    <span className="text-sm font-normal leading-6 text-muted-foreground">
                      Revisión manual antes de escribir en la base.
                    </span>
                  }
                />
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-white/6 bg-black/10 p-3">
                  <div className="flex items-start gap-3">
                    <Files className="mt-0.5 size-4 text-z-brass shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-z-white">Qué resuelve este flujo</p>
                      <p className="text-xs text-muted-foreground">
                        Sube el archivo, confirma la cuenta, aprende destinatarios y resuelve duplicados.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/6 bg-black/10 p-3">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 size-4 text-z-brass shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-z-white">Si no tienes cuentas aún</p>
                      <p className="text-xs text-muted-foreground">
                        Puedes crear una durante la revisión sin salir del flujo.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </details>
        }
      />
    </div>
  );
}
