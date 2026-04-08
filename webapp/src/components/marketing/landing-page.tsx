import Link from "next/link";
import { BrandIcon } from "@/components/app/brand-icon";
import { LandingHeader } from "./landing-header";
import { LandingHero } from "./landing-hero";
import { LandingBudget } from "./landing-budget";
import { LandingPlan } from "./landing-plan";
import { LandingShowcase } from "./landing-showcase";
import {
  LandingFeatures,
  LandingAudience,
  LandingHowItWorks,
  LandingFAQ,
} from "./landing-features";
import { LandingCTA } from "./landing-cta";

export function MarketingLandingPage() {
  return (
    <div className="relative overflow-hidden bg-background text-foreground">
      {/* Ambient gradients */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(197,191,174,0.14),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(82,183,136,0.14),transparent_22%),radial-gradient(circle_at_50%_65%,rgba(244,162,97,0.12),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-[-18rem] h-[32rem] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(197,191,174,0.16),transparent,rgba(233,196,106,0.12),transparent,rgba(82,183,136,0.1),transparent)] blur-3xl" />

      <LandingHeader />

      <main className="relative">
        <LandingHero />
        <LandingBudget />
        <LandingPlan />
        <LandingShowcase />
        <LandingFeatures />
        <LandingAudience />
        <LandingHowItWorks />
        <LandingCTA />
        <LandingFAQ />
      </main>

      {/* Footer */}
      <footer className="relative border-t border-white/6">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BrandIcon className="size-8 rounded-xl border border-white/10 shadow-lg shadow-black/15" />
            <p className="text-xs text-muted-foreground">Finanzas personales con claridad diaria</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-muted-foreground transition-colors hover:text-foreground">Entrar</Link>
            <Link href="/signup" className="text-z-brass transition-colors hover:text-z-brass/80">Crear cuenta</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
