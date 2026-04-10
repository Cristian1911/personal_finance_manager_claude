import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ArrowRight, Bug, Mail, Tag, UserRound } from "lucide-react";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { Button } from "@/components/ui/button";
import { PageHeaderRow } from "@/components/ui/page-header-row";
import { SummaryCard } from "@/components/ui/summary-card";
import { AttentionCard } from "@/components/ui/attention-card";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import { ProfileForm } from "@/components/settings/profile-form";
import { BugReportForm } from "@/components/settings/bug-report-form";
import { IntegrationsCard } from "@/components/settings/integrations-card";
import { EmailIngestCard } from "@/components/settings/email-ingest-card";
import { UnrecognizedEmailsCard } from "@/components/settings/unrecognized-emails-card";
import { EmailIngestLogsCard } from "@/components/settings/email-ingest-logs-card";
import { BuildInfo } from "@/components/settings/build-info";
import { ReviewModeToggle } from "@/components/settings/review-mode-toggle";
import { SettingsMobileAccordion } from "@/components/settings/settings-mobile-accordion";
import { DemoModeCard } from "@/components/settings/demo-mode-card";
import { getCaptureTokens } from "@/actions/capture-tokens";
import { getEmailIngestAddress, getEmailIngestLogs, getUnrecognizedEmails } from "@/actions/email-ingest";
import { getTagGroups } from "@/actions/tags";
import { TagManager } from "@/components/tags/tag-manager";
import type { Account } from "@/types/domain";

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

  const [tokensResult, { data: accounts }, emailIngestResult, unrecognizedResult, emailLogsResult, tagGroupsResult] = await Promise.all([
    getCaptureTokens(),
    supabase
      .from("accounts")
      .select("id, name, currency_code, account_type, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("display_order"),
    getEmailIngestAddress(),
    getUnrecognizedEmails(),
    getEmailIngestLogs(),
    getTagGroups(),
  ]);

  const tokens = tokensResult.success ? tokensResult.data : [];
  const emailIngestAddress = emailIngestResult.success ? emailIngestResult.data : null;
  const unrecognizedEmails = unrecognizedResult.success ? unrecognizedResult.data : [];
  const emailLogs = emailLogsResult.success ? emailLogsResult.data : [];
  const memberSince = new Date(profile.created_at).toLocaleDateString("es-CO");

  const accordionSections = [
    {
      id: "perfil",
      title: "Perfil",
      icon: <UserRound className="size-4 text-z-brass" />,
      children: <ProfileForm profile={profile} />,
    },
    {
      id: "integraciones",
      title: "Integraciones",
      icon: <Activity className="size-4 text-z-brass" />,
      children: (
        <IntegrationsCard accounts={(accounts ?? []) as Account[]} tokens={tokens} />
      ),
    },
    {
      id: "email",
      title: "Email",
      icon: <Mail className="size-4 text-z-brass" />,
      children: (
        <div className="space-y-4">
          <EmailIngestCard
            accounts={(accounts ?? []) as Account[]}
            initialAddress={emailIngestAddress}
          />
          <UnrecognizedEmailsCard initialEmails={unrecognizedEmails} />
          <EmailIngestLogsCard initialLogs={emailLogs} />
        </div>
      ),
    },
    {
      id: "etiquetas",
      title: "Etiquetas",
      icon: <Tag className="size-4 text-z-brass" />,
      children: tagGroupsResult.success ? (
        <TagManager tagGroups={tagGroupsResult.data} />
      ) : (
        <p className="text-sm text-destructive">{tagGroupsResult.error}</p>
      ),
    },
    {
      id: "bug",
      title: "Reportar bug",
      icon: <Bug className="size-4 text-z-brass" />,
      children: <BugReportForm />,
    },
  ];

  return (
    <div className="max-w-4xl space-y-6 lg:space-y-8">
      <MobileHeader variant="sub" title="Ajustes" backHref="/gestionar" />

      <PageHeaderRow
        title="Ajustes"
        subtitle={profile.full_name || "Sin nombre visible"}
        actions={
          <Button asChild className={BRASS_BUTTON_CLASS}>
            <Link href="/settings/analytics">
              Ver actividad de uso
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SummaryCard
          label="Perfil"
          metrics={[
            { label: "Perfil activo", value: profile.full_name || "—", context: profile.email },
            { label: "Correo", value: profile.email },
            { label: "Miembro desde", value: memberSince },
          ]}
        />
        <AttentionCard signals={[]} />
      </div>

      {/* Mobile: accordion */}
      <div className="lg:hidden">
        <SettingsMobileAccordion sections={accordionSections} />
      </div>

      {/* Desktop: flat card list */}
      <div className="hidden lg:block space-y-6">
        <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/6 bg-black/10">
                <UserRound className="size-4 text-z-brass" />
              </div>
              <CardTitle>Perfil</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ProfileForm profile={profile} />
          </CardContent>
        </Card>

        <IntegrationsCard accounts={(accounts ?? []) as Account[]} tokens={tokens} />

        <EmailIngestCard
          accounts={(accounts ?? []) as Account[]}
          initialAddress={emailIngestAddress}
        />

        <UnrecognizedEmailsCard initialEmails={unrecognizedEmails} />

        <EmailIngestLogsCard initialLogs={emailLogs} />

        <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/6 bg-black/10">
                <Tag className="size-4 text-z-brass" />
              </div>
              <CardTitle>Etiquetas</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Organiza etiquetas en grupos para anotar transacciones, destinatarios y categorías.
            </p>
          </CardHeader>
          <CardContent>
            {tagGroupsResult.success ? (
              <TagManager tagGroups={tagGroupsResult.data} />
            ) : (
              <p className="text-sm text-destructive">{tagGroupsResult.error}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/6 bg-black/10">
                <Bug className="size-4 text-z-brass" />
              </div>
              <CardTitle>Reportar bug</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <BugReportForm />
          </CardContent>
        </Card>

        <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/6 bg-black/10">
                <Activity className="size-4 text-z-brass" />
              </div>
              <CardTitle>Actividad de uso</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild className={cn(BRASS_BUTTON_CLASS, "w-full")}>
              <Link href="/settings/analytics">
                Abrir actividad de uso
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Shared bottom items — always visible */}
      <DemoModeCard initialDemoMode={profile.demo_mode ?? false} />

      <BuildInfo />

      <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <CardHeader>
          <CardTitle className="text-base">Herramientas de Desarrollo</CardTitle>
        </CardHeader>
        <CardContent>
          <ReviewModeToggle />
        </CardContent>
      </Card>
    </div>
  );
}
