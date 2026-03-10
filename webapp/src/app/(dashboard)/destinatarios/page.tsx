import { getDestinatarios } from "@/actions/destinatarios";
import { getCategories } from "@/actions/categories";
import { DestinatarioList } from "@/components/destinatarios/destinatario-list";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function DestinatariosPage() {
  const [destResult, catResult] = await Promise.all([
    getDestinatarios(),
    getCategories(),
  ]);

  const destinatarios = destResult.success ? destResult.data : [];
  const categories = catResult.success ? catResult.data : [];

  // Build a flat category map: id -> display name (name_es preferred)
  const categoryMap: Record<string, string> = {};
  for (const cat of categories) {
    categoryMap[cat.id] = cat.name_es ?? cat.name;
    for (const child of cat.children) {
      categoryMap[child.id] = child.name_es ?? child.name;
    }
  }

  return (
    <div className="space-y-6">
      <MobilePageHeader title="Destinatarios" backHref="/gestionar" />
      <div className="hidden lg:flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Destinatarios</h1>
          <p className="text-muted-foreground">
            {destinatarios.length} destinatario{destinatarios.length !== 1 ? "s" : ""} registrado{destinatarios.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button asChild>
          <Link href="/destinatarios/nuevo">
            <Plus className="size-4 mr-2" />
            Crear destinatario
          </Link>
        </Button>
      </div>

      <DestinatarioList
        destinatarios={destinatarios}
        categoryMap={categoryMap}
      />
    </div>
  );
}
