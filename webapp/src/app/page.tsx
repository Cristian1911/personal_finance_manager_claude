import type { Metadata } from "next";

import { MarketingLandingPage } from "@/components/marketing/landing-page";

const TITLE = "Zeta — Tu plata, sin ruido.";
const DESCRIPTION =
  "Una app de finanzas personales para quienes odian las apps de finanzas personales. Silenciosa, honesta, hecha para saber si vas bien — no para convencerte de que sí.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    locale: "es_CO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function HomePage() {
  return <MarketingLandingPage />;
}
