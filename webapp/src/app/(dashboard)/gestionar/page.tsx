import { connection } from "next/server";
import { getAttentionSnapshot } from "@/actions/attention";
import { PageHeaderRow } from "@/components/ui/page-header-row";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { AttentionHub } from "@/components/gestionar/attention-hub";
import { MobileLinkGrid } from "@/components/mobile/mobile-link-grid";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";
import { PAGE_STACK_CLASS } from "@/lib/constants/styles";

export default async function BandejaPage() {
  await connection();
  const snapshot = await getAttentionSnapshot();

  return (
    <div className={PAGE_STACK_CLASS}>
      <MobilePageHeader title="Bandeja" />

      {/* Desktop */}
      <div className="hidden lg:block space-y-6">
        <div className="space-y-1">
          <SectionEyebrow>Gestionar</SectionEyebrow>
          <PageHeaderRow
            title="Bandeja"
            subtitle={
              snapshot.totalAction > 0
                ? `${snapshot.totalAction} pendientes`
                : snapshot.totalSuggestion > 0
                  ? `${snapshot.totalSuggestion} sugerencias`
                  : "Todo al día"
            }
          />
        </div>
        <AttentionHub signals={snapshot.signals} />
      </div>

      {/* Mobile */}
      <div className="lg:hidden space-y-6">
        <AttentionHub signals={snapshot.signals} />
        <div className="space-y-3">
          <SectionEyebrow>Ir a</SectionEyebrow>
          <MobileLinkGrid />
        </div>
      </div>
    </div>
  );
}
