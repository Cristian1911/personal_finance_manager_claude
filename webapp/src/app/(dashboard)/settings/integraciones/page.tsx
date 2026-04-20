import { connection } from "next/server";
import { redirect } from "next/navigation";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { PageHeaderRow } from "@/components/ui/page-header-row";
import { SettingsBackLink } from "@/components/settings/settings-back-link";
import { IntegrationsCard } from "@/components/settings/integrations-card";
import { getCaptureTokens } from "@/actions/capture-tokens";
import { getAccounts } from "@/actions/accounts";
import type { Account } from "@/types/domain";

export default async function IntegracionesSettingsPage() {
  await connection();

  const [tokensResult, accountsResult] = await Promise.all([
    getCaptureTokens(),
    getAccounts(),
  ]);

  if (!accountsResult.success) redirect("/login");
  const accounts = accountsResult.data;
  const tokens = tokensResult.success ? tokensResult.data : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6 lg:space-y-8">
      <MobileHeader variant="sub" title="Integraciones" backHref="/settings" />
      <div className="space-y-2">
        <SettingsBackLink />
        <PageHeaderRow
          title="Integraciones"
          subtitle="Telegram, asistentes de IA y tokens de captura"
        />
      </div>
      <IntegrationsCard accounts={accounts as Account[]} tokens={tokens} />
    </div>
  );
}
