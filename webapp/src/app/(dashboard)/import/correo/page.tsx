import { connection } from "next/server";
import Link from "next/link";
import { FileUp } from "lucide-react";
import { getPendingEmailTransactions } from "@/actions/email-ingest";
import { EmailInbox } from "@/components/import/email-inbox";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { CHIP_NEUTRAL_CLASS, PAGE_STACK_CLASS } from "@/lib/constants/styles";

export const metadata = { title: "Pendientes por correo" };

export default async function EmailInboxPage() {
  await connection();
  const result = await getPendingEmailTransactions();
  const pending = result.success ? result.data : [];

  return (
    <div className={PAGE_STACK_CLASS}>
      <MobileHeader variant="sub" title="Pendientes por correo" backHref="/transactions" />

      <div className="hidden lg:flex lg:flex-wrap lg:items-end lg:justify-between lg:gap-4">
        <div className="max-w-2xl space-y-1">
          <SectionEyebrow>Importar</SectionEyebrow>
          <h1 className="text-3xl font-semibold tracking-tight">Pendientes por correo</h1>
          <p className="text-sm text-muted-foreground">
            Revisa cada alerta del banco con su contexto, déjala categorizada y etiquetada, e
            impórtala cuando esté lista.
          </p>
        </div>
        <Link href="/import" className={`${CHIP_NEUTRAL_CLASS} hover:bg-white/[0.06]`}>
          <FileUp className="size-3.5 text-z-sage-dark" />
          Subir extracto PDF
        </Link>
      </div>

      <EmailInbox transactions={pending} />
    </div>
  );
}
