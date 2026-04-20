import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/legal-layout";
import { TermsContentEn } from "@/components/legal/terms-content";

export const metadata: Metadata = {
  title: "Terms of Service · Zeta",
  description: "The terms under which you may use Zeta.",
  alternates: {
    languages: { es: "/terms" },
  },
};

export default function TermsEnPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      lastUpdated="April 20, 2026"
      alternateLanguage={{ href: "/terms", label: "Español" }}
    >
      <TermsContentEn />
    </LegalLayout>
  );
}
