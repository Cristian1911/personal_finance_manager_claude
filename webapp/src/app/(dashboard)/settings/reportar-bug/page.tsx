import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { PageHeaderRow } from "@/components/ui/page-header-row";
import { SettingsBackLink } from "@/components/settings/settings-back-link";
import { BugReportForm } from "@/components/settings/bug-report-form";

export default async function ReportarBugSettingsPage() {
  await connection();
  const { user } = await getAuthenticatedClient();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl space-y-6 lg:space-y-8">
      <MobileHeader variant="sub" title="Reportar bug" backHref="/settings" />
      <div className="space-y-2">
        <SettingsBackLink />
        <PageHeaderRow
          title="Reportar bug"
          subtitle="Cuéntanos qué salió mal para arreglarlo rápido"
        />
      </div>
      <BugReportForm />
    </div>
  );
}
