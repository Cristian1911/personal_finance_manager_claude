import { notFound } from "next/navigation";
import { getModoSummary } from "@/actions/modos";
import { ModoSummaryView } from "@/components/modos/modo-summary-view";

export default async function ModoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getModoSummary(id);
  if (!result.success) notFound();
  return <ModoSummaryView {...result.data} />;
}
