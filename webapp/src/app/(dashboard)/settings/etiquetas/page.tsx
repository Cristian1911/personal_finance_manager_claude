import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { PageHeaderRow } from "@/components/ui/page-header-row";
import { SettingsBackLink } from "@/components/settings/settings-back-link";
import { TagManager } from "@/components/tags/tag-manager";
import { getTagGroups } from "@/actions/tags";

export default async function EtiquetasSettingsPage() {
  await connection();
  const { user } = await getAuthenticatedClient();
  if (!user) redirect("/login");

  const tagGroupsResult = await getTagGroups();

  return (
    <div className="mx-auto max-w-2xl space-y-6 lg:space-y-8">
      {/* Sin backHref: usa historial — se llega aquí tanto desde /gestionar (vía /etiquetas) como desde /settings */}
      <MobileHeader variant="sub" title="Etiquetas" />
      <div className="hidden lg:block space-y-2">
        <SettingsBackLink />
        <PageHeaderRow
          title="Etiquetas"
          subtitle="Organiza etiquetas en grupos para transacciones, destinatarios y categorías"
        />
      </div>
      {tagGroupsResult.success ? (
        <TagManager tagGroups={tagGroupsResult.data} />
      ) : (
        <p className="text-sm text-destructive">{tagGroupsResult.error}</p>
      )}
    </div>
  );
}
