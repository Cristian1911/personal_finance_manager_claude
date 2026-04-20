import { connection } from "next/server";
import { redirect } from "next/navigation";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { PageHeaderRow } from "@/components/ui/page-header-row";
import { ProfileForm } from "@/components/settings/profile-form";
import { SettingsBackLink } from "@/components/settings/settings-back-link";
import { getProfile } from "@/actions/profile";

export default async function PerfilSettingsPage() {
  await connection();
  const profileResult = await getProfile();
  if (!profileResult.success) redirect("/login");
  const profile = profileResult.data;

  return (
    <div className="mx-auto max-w-2xl space-y-6 lg:space-y-8">
      <MobileHeader variant="sub" title="Perfil" backHref="/settings" />
      <div className="space-y-2">
        <SettingsBackLink />
        <PageHeaderRow
          title="Perfil"
          subtitle="Nombre, moneda principal y salario estimado"
        />
      </div>
      <ProfileForm profile={profile} />
    </div>
  );
}
