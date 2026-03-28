import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ArrowRight, Bug, ShieldCheck, UserRound } from "lucide-react";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";
import { Button } from "@/components/ui/button";
import { PageHero, HeroPill, HeroAccentPill } from "@/components/ui/page-hero";
import { StatCard } from "@/components/ui/stat-card";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import { ProfileForm } from "@/components/settings/profile-form";
import { BugReportForm } from "@/components/settings/bug-report-form";
import { BuildInfo } from "@/components/settings/build-info";

export default async function SettingsPage() {
  await connection();
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const memberSince = new Date(profile.created_at).toLocaleDateString("es-CO");

  return (
    <div className="max-w-4xl space-y-6 lg:space-y-8">
      <MobilePageHeader title="Ajustes" backHref="/gestionar" />

      <PageHero
        pills={<><HeroPill>Sistema y perfil</HeroPill><HeroAccentPill>Hub de confianza</HeroAccentPill></>}
        title="Ajusta la capa personal y el contexto que sostiene el workspace"
        description="Aquí no decides sobre dinero; decides sobre la calidad del sistema: tu perfil, la trazabilidad de los errores y las herramientas internas para seguir refinando la app."
        actions={
          <>
            <Button asChild className={BRASS_BUTTON_CLASS}>
              <Link href="/settings/analytics">
                Ver analytics interno
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className={GHOST_BUTTON_CLASS}>
              <Link href="/gestionar">Volver a Más</Link>
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Perfil activo"
            value={
              <span className="truncate text-lg text-z-sage-light">
                {profile.full_name || "Sin nombre visible"}
              </span>
            }
            description="Identidad usada para personalizar la experiencia."
          />
          <StatCard
            label="Correo principal"
            value={
              <span className="truncate text-lg">
                {profile.email}
              </span>
            }
            description="Canal base para acceso y recuperación."
          />
          <StatCard
            label="Miembro desde"
            value={<span className="text-lg">{memberSince}</span>}
            description="Antigüedad de esta cuenta dentro del producto."
          />
          <StatCard
            label={
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                <ShieldCheck className="size-4 text-z-brass" />
                Qué controlas aquí
              </div>
            }
            value={
              <span className="text-sm font-normal leading-6 text-muted-foreground">
                Perfil, feedback de bugs y métricas internas de producto sin tocar los datos financieros.
              </span>
            }
          />
        </div>
      </PageHero>

      <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/6 bg-black/10">
              <UserRound className="size-4 text-z-brass" />
            </div>
            <div className="space-y-1">
              <CardTitle>Perfil</CardTitle>
              <p className="text-sm text-muted-foreground">
                Mantén correcto el contexto personal que alimenta onboarding, copy y preferencias base.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile} />
        </CardContent>
      </Card>

      <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/6 bg-black/10">
              <Activity className="size-4 text-z-brass" />
            </div>
            <div className="space-y-1">
              <CardTitle>Control interno</CardTitle>
              <p className="text-sm text-muted-foreground">
                Funnel y calidad de producto para revisar fuera del flujo del usuario final.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button asChild className={cn(BRASS_BUTTON_CLASS, "w-full")}>
            <Link href="/settings/analytics">
              Abrir analytics interno
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <p className="text-sm leading-6 text-muted-foreground">
            Úsalo para revisar funnels de importación, activación y categorización sin mezclarlo con el producto principal.
          </p>
        </CardContent>
      </Card>

      <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/6 bg-black/10">
              <Bug className="size-4 text-z-brass" />
            </div>
            <div className="space-y-1">
              <CardTitle>Reportar bug</CardTitle>
              <p className="text-sm text-muted-foreground">
                Envía evidencia y contexto para que podamos reproducir y corregir el problema.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <BugReportForm />
        </CardContent>
      </Card>

      <BuildInfo />
    </div>
  );
}
