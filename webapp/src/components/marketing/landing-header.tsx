"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { BrandIcon } from "@/components/app/brand-icon";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { LANDING_NAV_LINKS } from "./landing-data";

export function LandingHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <header className="relative border-b border-white/6 bg-background/70 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <BrandIcon
            className="size-10 rounded-2xl border border-white/10 shadow-lg shadow-black/15"
            priority
          />
          <div>
            <p className="text-sm font-semibold tracking-[0.18em] text-z-sage-light uppercase">
              Zeta
            </p>
            <p className="text-xs text-muted-foreground">
              Finanzas personales con claridad diaria
            </p>
          </div>
        </div>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          {LANDING_NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA buttons + mobile hamburger */}
        <div className="flex items-center gap-3">
          {/* Desktop: Entrar */}
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href="/login">Entrar</Link>
          </Button>

          {/* Desktop: Crear cuenta */}
          <Button
            asChild
            className="hidden rounded-full bg-primary px-5 text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 sm:inline-flex"
          >
            <Link href="/signup">Crear cuenta</Link>
          </Button>

          {/* Mobile: Crear cuenta (always visible) */}
          <Button
            asChild
            className="rounded-full bg-primary px-4 text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 sm:hidden"
            size="sm"
          >
            <Link href="/signup">Crear cuenta</Link>
          </Button>

          {/* Mobile: hamburger */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Abrir menú"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
        </div>
      </div>

      {/* Mobile drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-center text-base">Menú</DrawerTitle>
          </DrawerHeader>

          <nav className="flex flex-col gap-1 px-4 pb-2">
            {LANDING_NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-3 text-base text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => setDrawerOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex flex-col gap-3 p-4 pt-2">
            <Button asChild variant="outline" className="w-full">
              <Link href="/login" onClick={() => setDrawerOpen(false)}>
                Entrar
              </Link>
            </Button>
            <Button
              asChild
              className="w-full rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
            >
              <Link href="/signup" onClick={() => setDrawerOpen(false)}>
                Crear cuenta
              </Link>
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </header>
  );
}
