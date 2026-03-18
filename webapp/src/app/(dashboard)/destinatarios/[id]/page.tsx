import { connection } from "next/server";
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import {
  getDestinatario,
  getDestinatarioTransactions,
} from "@/actions/destinatarios";
import { getCategories } from "@/actions/categories";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";
import { buildCategoryMap } from "@/lib/utils/categories";

const DestinatarioDetail = dynamic(
  () => import("@/components/destinatarios/destinatario-detail").then((m) => ({ default: m.DestinatarioDetail })),
  { loading: () => <div className="h-64 rounded-xl bg-muted animate-pulse" /> }
);

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function DestinatarioDetailPage({ params }: PageProps) {
  await connection();
  const { id } = await params;

  const [destResult, catResult, txResult] = await Promise.all([
    getDestinatario(id),
    getCategories(),
    getDestinatarioTransactions(id),
  ]);

  if (!destResult.success || !destResult.data) {
    notFound();
  }

  const destinatario = destResult.data;
  const categories = catResult.success ? catResult.data : [];
  const transactions = txResult.success ? txResult.data : [];

  const categoryMap = buildCategoryMap(categories);

  return (
    <div className="space-y-6">
      <MobilePageHeader
        title={destinatario.name}
        backHref="/destinatarios"
      />
      <div className="hidden lg:block">
        <h1 className="text-2xl font-bold">{destinatario.name}</h1>
        <p className="text-muted-foreground">Detalle del destinatario</p>
      </div>

      <DestinatarioDetail
        destinatario={destinatario}
        categories={categories}
        categoryMap={categoryMap}
        transactions={transactions}
      />
    </div>
  );
}
