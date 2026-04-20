import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/legal-layout";
import { PrivacyContentEs } from "@/components/legal/privacy-content";

export const metadata: Metadata = {
  title: "Política de Privacidad · Zeta",
  description: "Cómo Zeta recolecta, usa y protege tu información personal y financiera.",
  alternates: {
    languages: { en: "/privacy/en" },
  },
};

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Política de Privacidad"
      lastUpdated="20 de abril de 2026"
      alternateLanguage={{ href: "/privacy/en", label: "English" }}
    >
      <PrivacyContentEs />
    </LegalLayout>
  );
}
