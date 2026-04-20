import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/legal-layout";
import { TermsContentEs } from "@/components/legal/terms-content";

export const metadata: Metadata = {
  title: "Términos de Servicio · Zeta",
  description: "Los términos bajo los cuales puedes usar Zeta.",
  alternates: {
    languages: { en: "/terms/en" },
  },
};

export default function TermsPage() {
  return (
    <LegalLayout
      title="Términos de Servicio"
      lastUpdated="20 de abril de 2026"
      alternateLanguage={{ href: "/terms/en", label: "English" }}
    >
      <TermsContentEs />
    </LegalLayout>
  );
}
