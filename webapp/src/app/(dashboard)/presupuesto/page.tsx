import { redirect } from "next/navigation";

export default function PresupuestoPage() {
  redirect("/plan?tab=presupuesto");
}
