import { connection } from "next/server";
import { getAttentionSnapshot } from "@/actions/attention";
import { PageHeaderRow } from "@/components/ui/page-header-row";
import { AttentionHub } from "@/components/gestionar/attention-hub";
import { MobileLinkGrid } from "@/components/mobile/mobile-link-grid";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";

export default async function BandejaPage() {
  await connection();
  const snapshot = await getAttentionSnapshot();

  return (
    <div className="space-y-6">
      <MobilePageHeader title="Bandeja" />

      {/* Desktop */}
      <div className="hidden lg:block space-y-6">
        <PageHeaderRow
          title="Bandeja"
          subtitle={
            snapshot.totalAction > 0
              ? `${snapshot.totalAction} pendientes`
              : "Todo al día"
          }
        />
        <AttentionHub signals={snapshot.signals} />
      </div>

      {/* Mobile */}
      <div className="lg:hidden space-y-6">
        <AttentionHub signals={snapshot.signals} />
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Ir a
          </p>
          <MobileLinkGrid />
        </div>
      </div>
    </div>
  );
}
