import { connection } from "next/server";
import { getReminders } from "@/actions/reminders";
import { RemindersList } from "@/components/reminders/reminders-list";
import { MobilePageHeader } from "@/components/mobile/mobile-page-header";

export default async function PendientesPage() {
  await connection();
  const [pending, completed] = await Promise.all([
    getReminders("pending"),
    getReminders("completed"),
  ]);

  const recentCompleted = completed.slice(0, 10);

  return (
    <div className="space-y-6">
      <MobilePageHeader title="Pendientes" backHref="/dashboard" />

      <div className="hidden lg:block space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          Pendientes
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Tu lista de pendientes financieros
        </h1>
        <p className="text-muted-foreground">
          Cosas que debes pagar o resolver. No son recurrentes, solo tareas puntuales.
        </p>
      </div>

      <div className="lg:hidden space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          Pendientes
        </p>
        <h1 className="text-2xl font-semibold">Tus pendientes financieros</h1>
        <p className="text-sm text-muted-foreground">
          Tareas puntuales que debes pagar o resolver.
        </p>
      </div>

      <RemindersList pending={pending} completed={recentCompleted} />
    </div>
  );
}
