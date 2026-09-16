import Link from "next/link";
import { connection } from "next/server";
import { MapPin, Plus } from "lucide-react";
import { listModosWithTotals } from "@/actions/modos";
import { ModosList } from "@/components/modos/modos-list";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { HeroPill, PageHero } from "@/components/ui/page-hero";
import { BRASS_BUTTON_CLASS, PAGE_STACK_CLASS } from "@/lib/constants/styles";

export default async function ModosPage() {
  await connection();
  const result = await listModosWithTotals();
  const modos = result.success ? result.data : [];
  const active = modos.find((m) => m.is_active);
  const pendingReview = modos.reduce((s, m) => s + m.pendingReviewCount, 0);

  const newButton = (
    <Button asChild className={BRASS_BUTTON_CLASS}>
      <Link href="/modos/nuevo">
        <Plus className="size-4" />
        Nuevo viaje
      </Link>
    </Button>
  );

  return (
    <div className={PAGE_STACK_CLASS}>
      <MobileHeader variant="main" title="Viajes y eventos" action={newButton} />
      <div className="hidden lg:block">
        <PageHero
          variant="brass"
          pills={
            <>
              <HeroPill>Viajes y eventos</HeroPill>
              {active && <HeroPill>Activo · {active.name}</HeroPill>}
              {pendingReview > 0 && <HeroPill>{pendingReview} por revisar</HeroPill>}
            </>
          }
          title="Viajes y eventos"
          description="Agrupa los gastos de un viaje o un evento por etiqueta y fechas, mira el total por moneda y repártelo con quien fuiste."
          actions={newButton}
        />
      </div>
      <div className="mx-auto w-full max-w-3xl">
        {modos.length === 0 ? (
          <EmptyState
            icon={<MapPin className="size-6" strokeWidth={1.5} />}
            title="Tu primer viaje o evento"
            description="Ponle nombre y fechas. Zeta etiqueta lo que registres mientras dure y te muestra el total, por categoría y por persona."
            primary={{ label: "Crear mi primer viaje", href: "/modos/nuevo" }}
          />
        ) : (
          <ModosList modos={modos} />
        )}
      </div>
    </div>
  );
}
