import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/legal-layout";
import { PrivacyContentEn } from "@/components/legal/privacy-content";

export const metadata: Metadata = {
  title: "Privacy Policy · Zeta",
  description: "How Zeta collects, uses, and protects your personal and financial information.",
  alternates: {
    languages: { es: "/privacy" },
  },
};

export default function PrivacyEnPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      lastUpdated="April 20, 2026"
      alternateLanguage={{ href: "/privacy", label: "Español" }}
    >
      <PrivacyContentEn />
    </LegalLayout>
  );
}
