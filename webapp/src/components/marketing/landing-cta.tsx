import { ArrowRight, Sparkles, ShieldCheck, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// ─── LandingCTA ──────────────────────────────────────────────────────────────

const BLURBS = [
  {
    icon: Sparkles,
    title: "Mensaje claro",
    description: "Cada pantalla responde una pregunta sobre tu dinero.",
  },
  {
    icon: ShieldCheck,
    title: "Sin credenciales",
    description:
      "Tus datos bancarios nunca salen de tu banco. Solo PDF.",
  },
  {
    icon: Target,
    title: "Hecho para Colombia",
    description: "Bancos locales, moneda local, contexto local.",
  },
  {
    icon: TrendingUp,
    title: "Escalable",
    description:
      "Multi-moneda, multi-cuenta, multi-deuda. Crece contigo.",
  },
] as const;

export function LandingCTA() {
  return (
    <section className="py-24">
      <Card className="overflow-hidden border-white/8 bg-gradient-to-br from-white/[0.06] via-background to-z-income/[0.04] shadow-2xl shadow-black/10">
        <CardContent className="p-8 sm:p-12">
          <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            {/* Left: headline + CTAs */}
            <div className="space-y-8">
              <div className="space-y-4">
                <Badge
                  variant="outline"
                  className="border-white/10 bg-white/4 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-z-sage-light"
                >
                  Empieza hoy
                </Badge>
                <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                  Toma el control de tus finanzas
                </h2>
                <p className="max-w-md text-base leading-7 text-muted-foreground">
                  Zeta te da claridad diaria sobre tu dinero — sin conectar
                  bancos, sin compartir credenciales. Importa tus extractos PDF
                  y empieza a planificar en minutos.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="gap-2">
                  <Link href="/signup">
                    Crear cuenta gratis
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-white/10 bg-white/[0.03]">
                  <Link href="#como-funciona">Ver cómo funciona</Link>
                </Button>
              </div>
            </div>

            {/* Right: 2x2 blurbs */}
            <div className="grid gap-4 sm:grid-cols-2">
              {BLURBS.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="rounded-xl border border-white/8 bg-white/[0.03] p-4 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-z-sage-light" />
                    <p className="text-sm font-medium text-foreground">
                      {title}
                    </p>
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
