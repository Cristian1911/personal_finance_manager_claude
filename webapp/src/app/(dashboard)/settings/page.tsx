import { connection } from "next/server";
import { redirect } from "next/navigation";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { BuildInfo } from "@/components/settings/build-info";
import { DemoModeCard } from "@/components/settings/demo-mode-card";
import { ReviewModeToggle } from "@/components/settings/review-mode-toggle";
import { SettingsIdentityHero } from "@/components/settings/settings-identity-hero";
import { SettingsNavigationList, type SettingsNavItem } from "@/components/settings/settings-navigation-list";
import { getEmailIngestAddress } from "@/actions/email-ingest";
import { listPdfPasswords } from "@/actions/pdf-passwords";
import { getProfile } from "@/actions/profile";
import { getTagGroups } from "@/actions/tags";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench } from "lucide-react";
import { PANEL_SURFACE_CLASS } from "@/lib/constants/styles";

export default async function SettingsPage() {
  await connection();

  const [profileResult, emailIngestResult, tagGroupsResult, pdfPasswords] =
    await Promise.all([
      getProfile(),
      getEmailIngestAddress(),
      getTagGroups(),
      listPdfPasswords(),
    ]);

  if (!profileResult.success) redirect("/login");
  const profile = profileResult.data;

  const tagGroupsCount = tagGroupsResult.success ? tagGroupsResult.data.length : 0;
  const pdfPasswordsCount = pdfPasswords.length;
  const emailIngestActive = emailIngestResult.success && emailIngestResult.data !== null;

  const memberSince = new Date(profile.created_at).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
  });

  const sections: { label: string; items: SettingsNavItem[] }[] = [
    {
      label: "Perfil y conexiones",
      items: [
        {
          key: "perfil",
          title: "Perfil",
          meta: "Nombre, moneda principal, salario estimado",
          href: "/settings/perfil",
          keywords: ["nombre", "moneda", "salario"],
        },
        {
          key: "integraciones",
          title: "Integraciones",
          meta: "Telegram, asistentes de IA, tokens de captura",
          href: "/settings/integraciones",
          keywords: ["telegram", "mcp", "ia", "claude", "api"],
        },
        {
          key: "email-ingest",
          title: "Importación por correo",
          meta: emailIngestActive ? "Activa" : "Desactivada",
          href: "/settings/email",
          keywords: ["email", "correo", "gmail", "ingest"],
        },
        {
          key: "pdf-passwords",
          title: "Contraseñas de PDF",
          meta: pdfPasswordsCount > 0 ? `${pdfPasswordsCount} guardadas` : "Sin contraseñas guardadas",
          href: "/settings/pdf-passwords",
          keywords: ["pdf", "password", "contraseña", "bancolombia"],
        },
      ],
    },
    {
      label: "Organización",
      items: [
        {
          key: "tags",
          title: "Etiquetas",
          meta: tagGroupsCount > 0 ? `${tagGroupsCount} grupos` : "Sin grupos creados",
          href: "/settings/etiquetas",
          keywords: ["tags", "etiqueta"],
        },
      ],
    },
    {
      label: "Privacidad y soporte",
      items: [
        {
          key: "analytics",
          title: "Actividad de uso",
          meta: "Tu historial dentro de Zeta",
          href: "/settings/analytics",
          keywords: ["analytics", "actividad", "uso"],
        },
        {
          key: "bug",
          title: "Reportar bug",
          meta: "Envíanos comentarios o errores",
          href: "/settings/reportar-bug",
          keywords: ["bug", "feedback", "reportar", "error"],
        },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6 lg:space-y-8">
      <MobileHeader variant="sub" title="Tú" backHref="/gestionar" />

      <SettingsIdentityHero
        name={profile.full_name ?? ""}
        email={profile.email}
        memberSince={memberSince}
      />

      <SettingsNavigationList sections={sections} />

      <DemoModeCard initialDemoMode={profile.demo_mode ?? false} />

      <p className="px-1 text-center text-[11px] leading-relaxed text-muted-foreground">
        Zeta no es un asesor financiero. La información mostrada es solo para organizar tus finanzas personales.
      </p>

      <BuildInfo />

      {process.env.NODE_ENV === "development" && (
        <Card className={PANEL_SURFACE_CLASS}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/6 bg-black/10">
                <Wrench className="size-4 text-z-brass" />
              </div>
              <CardTitle>Herramientas de desarrollo</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ReviewModeToggle />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
