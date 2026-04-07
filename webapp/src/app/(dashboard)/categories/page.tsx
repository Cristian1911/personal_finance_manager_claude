import { redirect } from "next/navigation";

export default function CategoriesPage() {
  redirect("/plan?tab=presupuesto");
}
