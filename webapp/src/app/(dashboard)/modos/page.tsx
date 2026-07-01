import { listModos } from "@/actions/modos";
import { ModosList } from "@/components/modos/modos-list";
import { ModoFormDialog } from "@/components/modos/modo-form-dialog";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";

export default async function ModosPage() {
  const result = await listModos();
  const modos = result.success ? result.data : [];

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Modos</h1>
        <ModoFormDialog
          trigger={
            <button type="button" className={BRASS_BUTTON_CLASS}>
              Nuevo modo
            </button>
          }
        />
      </div>
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
