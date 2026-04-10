"use client";

import { useRef, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { PhoneFrame } from "./phone-frame";
import {
  LANDING_SHOWCASE_PANELS,
  type ShowcasePanel,
} from "./landing-data";

// ─── Shared placeholder ───────────────────────────────────────────────────────

function ShowcasePlaceholder({ panel }: { panel: ShowcasePanel }) {
  const Icon = panel.icon;
  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-b ${panel.gradient}`}
    >
      <Icon className="h-10 w-10 text-white/40" />
      <p className="text-xs text-white/30">Vista previa próximamente</p>
    </div>
  );
}

// ─── Desktop card ─────────────────────────────────────────────────────────────

function ShowcaseCard({ panel }: { panel: ShowcasePanel }) {
  const Icon = panel.icon;
  return (
    <Card className="border-white/6 bg-z-surface-2 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/6">
            <Icon className="h-5 w-5 text-z-brass" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold text-white">
              {panel.title}
            </CardTitle>
          </div>
        </div>
        <CardDescription className="text-xs text-white/50 leading-relaxed pt-1">
          {panel.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="aspect-video w-full">
          <ShowcasePlaceholder panel={panel} />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Mobile carousel ──────────────────────────────────────────────────────────

const CARD_WIDTH = 280;
const CARD_GAP = 16;

function MobileCarousel({ panels }: { panels: ShowcasePanel[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeIdxRef = useRef(0);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function onScroll() {
      if (!el) return;
      const idx = Math.max(0, Math.min(
        Math.round(el.scrollLeft / (CARD_WIDTH + CARD_GAP)),
        panels.length - 1
      ));
      if (idx !== activeIdxRef.current) {
        activeIdxRef.current = idx;
        setActiveIdx(idx);
      }
    }

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [panels.length]);

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Scrollable track */}
      <div
        ref={scrollRef}
        className="flex w-full gap-4 pb-4"
        style={{
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
          paddingLeft: "max(16px, calc(50% - 140px))",
          paddingRight: "max(16px, calc(50% - 140px))",
        }}
      >
        {panels.map((panel) => {
          const Icon = panel.icon;
          return (
            <div
              key={panel.id}
              className="snap-center shrink-0"
              style={{ width: "min(280px, calc(100vw - 48px))" }}
            >
              <PhoneFrame>
                <div className="flex flex-col">
                  {/* Phone header */}
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-4 w-4 text-z-brass" />
                      <span className="text-xs font-semibold text-white">
                        {panel.title}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-white/50">
                      {panel.description}
                    </p>
                  </div>
                  {/* Placeholder area */}
                  <div className="aspect-[9/14]">
                    <ShowcasePlaceholder panel={panel} />
                  </div>
                </div>
              </PhoneFrame>
            </div>
          );
        })}
      </div>

      {/* Dot indicators */}
      <div className="flex items-center gap-1.5">
        {panels.map((panel, i) => (
          <button
            key={panel.id}
            aria-label={`Ir a ${panel.title}`}
            onClick={() => {
              scrollRef.current?.scrollTo({
                left: i * (CARD_WIDTH + CARD_GAP),
                behavior: "smooth",
              });
            }}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === activeIdx
                ? "w-4 bg-z-brass"
                : "w-1.5 bg-white/20"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function LandingShowcase() {
  return (
    <section id="showcase" className="py-16 sm:py-24 px-4">
      <div className="mx-auto max-w-5xl">
        {/* Heading */}
        <div className="mb-12 flex flex-col items-center gap-4 text-center">
          <Badge
            variant="outline"
            className="border-white/10 bg-white/4 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-z-sage-light"
          >
            Todo lo que hace
          </Badge>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Herramientas que responden preguntas, no crean trabajo
          </h2>
          <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
            Cada modulo esta pensado para responderte algo concreto sobre tu
            dinero.
          </p>
        </div>

        {/* Desktop grid */}
        <div className="hidden lg:grid lg:grid-cols-2 gap-6">
          {LANDING_SHOWCASE_PANELS.map((panel) => (
            <ShowcaseCard key={panel.id} panel={panel} />
          ))}
        </div>

        {/* Mobile carousel */}
        <div className="lg:hidden">
          <MobileCarousel panels={LANDING_SHOWCASE_PANELS} />
        </div>
      </div>
    </section>
  );
}
