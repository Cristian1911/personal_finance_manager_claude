import type { Metadata } from "next";

import { MarketingLandingPage } from "@/components/marketing/landing-page";

export const metadata: Metadata = {
  title: "Zeta | Finanzas personales para Colombia",
  description:
    "Controla tus finanzas personales con una vista clara de extractos, presupuesto, deudas, cuentas y pagos recurrentes.",
};

export default function HomePage() {
  return <MarketingLandingPage />;
}
