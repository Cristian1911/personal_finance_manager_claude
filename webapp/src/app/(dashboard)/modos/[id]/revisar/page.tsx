import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getModo, getModoCandidates } from "@/actions/modos";
import { ModoReview } from "@/components/modos/modo-review";

export default async function ModoReviewPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const modoRes = await getModo(id);
  if (!modoRes.success) notFound();
  const modo = modoRes.data;
  const candidates = await getModoCandidates(
    { date_from: modo.date_from, date_to: modo.date_to, tag_ids: modo.tag_ids },
    modo.id,
  );
  return <ModoReview modo={modo} candidates={candidates.success ? candidates.data : []} />;
}
