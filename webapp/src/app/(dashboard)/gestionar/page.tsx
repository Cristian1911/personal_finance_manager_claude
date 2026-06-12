import { connection } from "next/server";
import { getAttentionSnapshot } from "@/actions/attention";
import { PageHeaderRow } from "@/components/ui/page-header-row";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { AttentionHub } from "@/components/gestionar/attention-hub";
import { MobileLinkGrid } from "@/components/mobile/mobile-link-grid";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { PAGE_STACK_CLASS } from "@/lib/constants/styles";

export default async function MasPage() {
  await connection();
  const snapshot = await getAttentionSnapshot();

  const subtitle =
    snapshot.totalAction > 0
      ? `${snapshot.totalAction} pendientes`
      : snapshot.totalSuggestion > 0
        ? `${snapshot.totalSuggestion} sugerencias`
        : "Todo al día";

  return (
    <div className={PAGE_STACK_CLASS}>
      <MobileHeader variant="main" title="Más" subtitle={subtitle} />

      <div className="hidden lg:block space-y-1">
        <SectionEyebrow>Gestionar</SectionEyebrow>
        <PageHeaderRow title="Más" subtitle={subtitle} />
      </div>

      <AttentionHub signals={snapshot.signals} />
      <MobileLinkGrid />
    </div>
  );
}
