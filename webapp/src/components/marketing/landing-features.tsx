import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  LANDING_WORKFLOW,
  LANDING_FAQS,
  LANDING_INSTITUTIONS,
} from "./landing-data";

// ─── Shared helper ────────────────────────────────────────────────────────────

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl space-y-4">
      <Badge
        variant="outline"
        className="border-white/10 bg-white/4 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-z-sage-light"
      >
        {eyebrow}
      </Badge>
      <div className="space-y-3">
        <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h2>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          {description}
        </p>
      </div>
    </div>
  );
}

// ─── LandingAudience ─────────────────────────────────────────────────────────

const AUDIENCE_PROFILES = [
  {
    name: "Profesional independiente",
    description:
      "Freelancer o empleado que maneja más de un ingreso y necesita ver el estado real del mes sin hojas de cálculo.",
  },
  {
    name: "Pareja que comparte gastos",
    description:
      "Necesitan una vista honesta de lo que entra, lo que comprometen y cuánto margen les queda como unidad.",
  },
  {
    name: "Persona saliendo de deudas",
    description:
      "Busca una estrategia clara para priorizar pagos, reducir intereses y ver cuándo termina la carga.",
  },
  {
    name: "Primero organizando finanzas",
    description:
      "No tiene sistema aún y quiere un punto de partida práctico, no una app que pida más trabajo del que ahorra.",
  },
] as const;

export function LandingAudience() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Para quién encaja */}
        <Card className="border-white/8 bg-white/[0.03] shadow-2xl shadow-black/10">
          <CardHeader className="pb-4">
            <Badge
              variant="outline"
              className="w-fit border-white/10 bg-white/4 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-z-sage-light"
            >
              Audiencia
            </Badge>
            <CardTitle className="text-2xl">Para quién encaja</CardTitle>
            <CardDescription className="text-base leading-6">
              Zeta no intenta ser todo para todos. Está hecha para quienes
              quieren decidir con más claridad, no solo registrar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {AUDIENCE_PROFILES.map((profile) => (
                <div
                  key={profile.name}
                  className="rounded-xl border border-white/8 bg-white/[0.03] p-4 space-y-1"
                >
                  <p className="text-sm font-medium text-foreground">
                    {profile.name}
                  </p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {profile.description}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Hecho para Colombia */}
        <Card
          id="colombia"
          className="border-white/8 bg-white/[0.03] shadow-2xl shadow-black/10"
        >
          <CardHeader className="pb-4">
            <Badge
              variant="outline"
              className="w-fit border-white/10 bg-white/4 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-z-sage-light"
            >
              Colombia
            </Badge>
            <CardTitle className="text-2xl">Hecho para Colombia</CardTitle>
            <CardDescription className="text-base leading-6">
              Importación de extractos PDF de los bancos que usas, en el idioma
              que hablas, con el contexto financiero local.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {LANDING_INSTITUTIONS.map((institution) => (
                <span
                  key={institution}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-z-sage-light"
                >
                  {institution}
                </span>
              ))}
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              El lenguaje, el flujo de importación y los formatos de extracto
              están pensados para la realidad bancaria colombiana. No necesitas
              adaptar tu hábito a la app.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

// ─── LandingHowItWorks ───────────────────────────────────────────────────────

export function LandingHowItWorks() {
  return (
    <section id="como-funciona" className="mx-auto max-w-7xl space-y-12 px-4 py-16 sm:px-6 sm:py-24">
      <SectionHeading
        eyebrow="Proceso"
        title="Tres pasos para tener claridad financiera"
        description="Sin configuración larga, sin aprendizaje complejo. Empiezas con lo que tienes y el sistema empieza a responder preguntas."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        {LANDING_WORKFLOW.map((item) => (
          <Card
            key={item.step}
            className="border-white/8 bg-white/[0.03] shadow-2xl shadow-black/10"
          >
            <CardHeader className="gap-4">
              <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
                <span className="font-mono text-sm font-semibold text-z-sage-light">
                  {item.step}
                </span>
              </div>
              <div className="space-y-2">
                <CardTitle className="text-lg">{item.title}</CardTitle>
                <CardDescription className="text-sm leading-6 text-muted-foreground">
                  {item.description}
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
}

// ─── LandingFAQ ──────────────────────────────────────────────────────────────

export function LandingFAQ() {
  return (
    <section id="faq" className="mx-auto max-w-7xl space-y-12 px-4 py-16 sm:px-6 sm:py-24">
      <SectionHeading
        eyebrow="Preguntas frecuentes"
        title="Lo que más nos preguntan"
        description="Respuestas directas sobre cómo funciona Zeta y para qué está pensada."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {LANDING_FAQS.map((faq) => (
          <Card
            key={faq.question}
            className="border-white/8 bg-white/[0.03] shadow-2xl shadow-black/10"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">
                {faq.question}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                {faq.answer}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
