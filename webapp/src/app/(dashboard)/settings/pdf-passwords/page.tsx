import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { PageHeaderRow } from "@/components/ui/page-header-row";
import { SettingsBackLink } from "@/components/settings/settings-back-link";
import { PdfPasswordsCard } from "@/components/settings/pdf-passwords-card";
import { listPdfPasswords } from "@/actions/pdf-passwords";
import type { Account } from "@/types/domain";

export default async function PdfPasswordsSettingsPage() {
  await connection();
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) redirect("/login");

  const [{ data: accounts }, pdfPasswords] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, currency_code, account_type, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("display_order"),
    listPdfPasswords(),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 lg:space-y-8">
      <MobileHeader variant="sub" title="Contraseñas de PDF" backHref="/settings" />
      <div className="space-y-2">
        <SettingsBackLink />
        <PageHeaderRow
          title="Contraseñas de PDF"
          subtitle="Guárdalas para descifrar extractos cifrados automáticamente"
        />
      </div>
      <PdfPasswordsCard
        initialEntries={pdfPasswords}
        accounts={(accounts ?? []) as Account[]}
      />
    </div>
  );
}
