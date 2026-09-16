import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getModoWithParticipants } from "@/actions/modos";
import { getDestinatarios } from "@/actions/destinatarios";
import { ModoWizardHost } from "@/components/modos/modo-wizard-host";

export default async function EditModoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  await connection();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [result, destinatarios] = await Promise.all([getModoWithParticipants(id), getDestinatarios()]);
  if (!result.success) notFound();
  // Names for the participant pickers: ad-hoc people are hidden from the
  // provider's list, so fall back to a neutral label rather than blank.
  const nameById = new Map(
    (destinatarios.success ? destinatarios.data : []).map((d) => [d.id, d.name]),
  );
  return (
    <ModoWizardHost
      mode="edit"
      initial={result.data.modo}
      initialParticipants={result.data.participants.map((p) => ({
        ...p,
        name: nameById.get(p.destinatario_id) ?? "Persona",
      }))}
      presets={{ step: sp.step ? Number(sp.step) : undefined }}
    />
  );
}
