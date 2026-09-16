import { Suspense } from "react";
import { getModo } from "@/actions/modos";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { NewTransactionPageContent } from "@/components/mobile/new-transaction-page-content";
import { MOBILE_TAB_BAR_CLEARANCE_CLASS } from "@/lib/constants/styles";
import { UUID_RE } from "@/lib/validators/shared";

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ modo?: string }>;
}) {
  // "Agregar gasto a este viaje" (FAB on /modos/[id]) — resolve the trip's tag
  // here so the client form starts with it ticked, whether or not the trip is
  // the active one.
  const { modo: modoId } = await searchParams;
  let presetTagIds: string[] | undefined;
  let title = "Nueva transacción";
  if (modoId && UUID_RE.test(modoId)) {
    const res = await getModo(modoId);
    if (res.success) {
      const tagId = res.data.auto_tag_id ?? res.data.tag_ids[0];
      presetTagIds = tagId ? [tagId] : undefined;
      title = `Gasto en ${res.data.name}`;
    }
  }
  return (
    <>
      <MobileHeader
        variant="sub"
        title={title}
        backHref={modoId ? `/modos/${modoId}` : "/transactions"}
      />
      <div className={MOBILE_TAB_BAR_CLEARANCE_CLASS}>
        <div className="mx-auto max-w-lg px-4 py-6">
          <Suspense>
            <NewTransactionPageContent presetTagIds={presetTagIds} />
          </Suspense>
        </div>
      </div>
    </>
  );
}
