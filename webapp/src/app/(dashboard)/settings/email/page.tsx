import { connection } from "next/server";
import { redirect } from "next/navigation";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { PageHeaderRow } from "@/components/ui/page-header-row";
import { SettingsBackLink } from "@/components/settings/settings-back-link";
import { EmailIngestCard } from "@/components/settings/email-ingest-card";
import { UnrecognizedEmailsCard } from "@/components/settings/unrecognized-emails-card";
import { EmailIngestLogsCard } from "@/components/settings/email-ingest-logs-card";
import {
  getEmailIngestAddress,
  getEmailIngestLogs,
  getUnrecognizedEmails,
  getAllowedSenders,
} from "@/actions/email-ingest";
import { getAccounts } from "@/actions/accounts";
import type { Account } from "@/types/domain";

export default async function EmailSettingsPage() {
  await connection();

  const [
    accountsResult,
    emailIngestResult,
    unrecognizedResult,
    emailLogsResult,
    allowedSenders,
  ] = await Promise.all([
    getAccounts(),
    getEmailIngestAddress(),
    getUnrecognizedEmails(),
    getEmailIngestLogs(),
    getAllowedSenders(),
  ]);

  if (!accountsResult.success) redirect("/login");
  const accounts = accountsResult.data;
  const emailIngestAddress = emailIngestResult.success ? emailIngestResult.data : null;
  const unrecognizedEmails = unrecognizedResult.success ? unrecognizedResult.data : [];
  const emailLogs = emailLogsResult.success ? emailLogsResult.data : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6 lg:space-y-8">
      <MobileHeader variant="sub" title="Importación por correo" backHref="/settings" />
      <div className="space-y-2">
        <SettingsBackLink />
        <PageHeaderRow
          title="Importación por correo"
          subtitle="Reenvía correos bancarios a Zeta y deja que extraiga las transacciones"
        />
      </div>
      <EmailIngestCard
        accounts={accounts as Account[]}
        initialAddress={emailIngestAddress}
        initialAllowedSenders={allowedSenders}
      />
      <UnrecognizedEmailsCard initialEmails={unrecognizedEmails} />
      <EmailIngestLogsCard initialLogs={emailLogs} />
    </div>
  );
}
