import { connection } from "next/server";
import { getTagGroups } from "@/actions/tags";
import { TagManager } from "@/components/tags/tag-manager";

export default async function EtiquetasPage() {
  await connection();
  const result = await getTagGroups();

  if (!result.success) {
    return <p className="p-6 text-destructive">{result.error}</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Etiquetas</h1>
        <p className="text-sm text-muted-foreground">
          Organiza etiquetas en grupos para anotar transacciones, destinatarios y categorías.
        </p>
      </div>
      <TagManager tagGroups={result.data} />
    </div>
  );
}
