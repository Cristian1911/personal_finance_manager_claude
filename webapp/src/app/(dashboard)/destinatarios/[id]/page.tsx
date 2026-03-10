import { notFound } from "next/navigation";
import {
  getDestinatario,
  getDestinatarioTransactions,
} from "@/actions/destinatarios";
import { getCategories } from "@/actions/categories";
import { DestinatarioDetail } from "@/components/destinatarios/destinatario-detail";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function DestinatarioDetailPage({ params }: PageProps) {
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

  // Build a flat category map: id -> display name
  const categoryMap: Record<string, string> = {};
  for (const cat of categories) {
    categoryMap[cat.id] = cat.name_es ?? cat.name;
    for (const child of cat.children) {
      categoryMap[child.id] = child.name_es ?? child.name;
    }
  }

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
