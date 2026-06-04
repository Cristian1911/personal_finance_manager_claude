import { redirect } from "next/navigation";

// Legacy path — the module was reframed from "Personas" to "Deudas personales".
export default function PersonasRedirect() {
  redirect("/deudas-personales");
}
