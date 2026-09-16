import { connection } from "next/server";
import { ModoWizardHost } from "@/components/modos/modo-wizard-host";
import { parseTagsParam } from "@/lib/validators/modo";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function NuevoModoPage({
  searchParams,
}: {
  searchParams: Promise<{ tags?: string; dateFrom?: string; dateTo?: string; name?: string }>;
}) {
  await connection();
  const sp = await searchParams;
  return (
    <ModoWizardHost
      mode="create"
      presets={{
        name: sp.name?.slice(0, 80),
        tagIds: parseTagsParam(sp.tags),
        dateFrom: sp.dateFrom && DATE_RE.test(sp.dateFrom) ? sp.dateFrom : undefined,
        dateTo: sp.dateTo && DATE_RE.test(sp.dateTo) ? sp.dateTo : undefined,
      }}
    />
  );
}
