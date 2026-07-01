import { listModos } from "@/actions/modos";
import { ModosList } from "@/components/modos/modos-list";

export default async function ModosPage() {
  const result = await listModos();
  const modos = result.success ? result.data : [];

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Modos</h1>
      {modos.length === 0 ? (
        <p className="text-muted-foreground">
          Aún no tienes modos. Crea uno desde el filtro de una lista de
          transacciones etiquetadas.
        </p>
      ) : (
        <ModosList modos={modos} />
      )}
    </div>
  );
}
