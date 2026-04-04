import { connection } from "next/server";
import { getTagGroups } from "@/actions/tags";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";
import { TagManager } from "@/components/tags/tag-manager";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { PAGE_STACK_CLASS } from "@/lib/constants/styles";

export default async function EtiquetasPage() {
  await connection();
  const result = await getTagGroups();

  const pageHeader = (
    <>
      <MobilePageHeader title="Etiquetas" backHref="/gestionar" />

      <div className="space-y-1 lg:hidden">
        <SectionEyebrow>Etiquetas</SectionEyebrow>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ordena tu lenguaje común</h1>
          <p className="text-sm text-muted-foreground">
            Organiza etiquetas en grupos para anotar transacciones, destinatarios y categorías.
          </p>
        </div>
      </div>

      <div className="hidden lg:block space-y-1">
        <SectionEyebrow>Etiquetas</SectionEyebrow>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Ordena tu lenguaje común</h1>
          <p className="text-muted-foreground">
            Organiza etiquetas en grupos para anotar transacciones, destinatarios y categorías.
          </p>
        </div>
      </div>
    </>
  );

  if (!result.success) {
    return (
      <div className={`mx-auto max-w-2xl ${PAGE_STACK_CLASS}`}>
        {pageHeader}
        <p className="text-destructive">{result.error}</p>
      </div>
    );
  }

  return (
    <div className={`mx-auto max-w-2xl ${PAGE_STACK_CLASS}`}>
      {pageHeader}
      <TagManager tagGroups={result.data} />
    </div>
  );
}
