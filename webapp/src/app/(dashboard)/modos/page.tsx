import { MapPin } from "lucide-react";
import { listModos } from "@/actions/modos";
import { ModosList } from "@/components/modos/modos-list";
import { ModoFormDialog } from "@/components/modos/modo-form-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";

export default async function ModosPage() {
  const result = await listModos();
  const modos = result.success ? result.data : [];

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Modos</h1>
        <ModoFormDialog
          trigger={
            <button type="button" className={BRASS_BUTTON_CLASS}>
              Nuevo modo
            </button>
          }
        />
      </div>
      {modos.length === 0 ? (
        <EmptyState
          icon={<MapPin className="size-6" strokeWidth={1.5} />}
          title="Agrupa un viaje o evento en un Modo"
          description="Un Modo guarda las etiquetas y el rango de fechas de un gasto puntual. Créalo desde el filtro de una lista de transacciones etiquetadas, o con “Nuevo modo”."
        />
      ) : (
        <ModosList modos={modos} />
      )}
    </div>
  );
}
