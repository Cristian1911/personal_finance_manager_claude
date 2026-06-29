import type { ReactNode } from "react";
import Link from "next/link";

const DEFAULT_CONTACT_EMAIL = "giraldo.0302@gmail.com";

interface LegalLayoutProps {
  title: string;
  lastUpdated: string;
  alternateLanguage?: { href: string; label: string };
  contactEmail?: string;
  children: ReactNode;
}

export function LegalLayout({
  title,
  lastUpdated,
  alternateLanguage,
  contactEmail = DEFAULT_CONTACT_EMAIL,
  children,
}: LegalLayoutProps) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-white/6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-z-brass text-[13px] font-semibold text-black">
              Z
            </span>
            Zeta
          </Link>
          {alternateLanguage ? (
            <Link
              href={alternateLanguage.href}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {alternateLanguage.label}
            </Link>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 lg:py-16">
        <div className="mb-10 space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Legal
          </p>
          <h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">
            Última actualización · {lastUpdated}
          </p>
        </div>

        <article className="prose prose-invert prose-sm max-w-none space-y-6 text-[15px] leading-relaxed [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_li]:my-1 [&_p]:my-3 [&_ul]:ml-5 [&_ul]:list-disc">
          {children}
        </article>

        <footer className="mt-16 border-t border-white/6 pt-6 text-xs text-muted-foreground">
          <p>
            ¿Preguntas? Escríbenos a{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="text-foreground underline decoration-dotted underline-offset-2"
            >
              {contactEmail}
            </a>
            .
          </p>
        </footer>
      </main>
    </div>
  );
}
