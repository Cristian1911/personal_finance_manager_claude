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
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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
      <div className="hidden lg:flex lg:items-start lg:justify-between lg:gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
            Destinatarios
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">{destinatario.name}</h1>
          <p className="text-muted-foreground">
            Ajusta reglas, categoría por defecto y contexto para que el sistema lo reconozca mejor.
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="border-white/8 bg-black/10 text-z-sage-light hover:bg-white/5 hover:text-z-sage-light"
        >
          <Link href="/destinatarios">
            <ArrowLeft className="size-4 mr-2" />
            Volver a Destinatarios
          </Link>
        </Button>
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
