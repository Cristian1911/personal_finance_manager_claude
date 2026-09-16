import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getModoSummary } from "@/actions/modos";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { ModoSummaryView } from "@/components/modos/modo-summary-view";

export default async function ModoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const result = await getModoSummary(id);
  if (!result.success) notFound();
  return (
    <div className="space-y-6">
      <MobileHeader variant="sub" title={result.data.modo.name} backHref="/modos" />
      <div className="mx-auto w-full max-w-3xl">
        <ModoSummaryView {...result.data} />
      </div>
    </div>
  );
}
