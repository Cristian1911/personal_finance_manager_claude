"use client";

import Link from "next/link";
import { ChevronRight, User, Palette, Tags, Contact, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsLink {
  href: string;
  icon: typeof User;
  label: string;
  description?: string;
}

const SECTIONS: { title: string; links: SettingsLink[] }[] = [
  {
    title: "Perfil",
    links: [
      { href: "/settings", icon: User, label: "Cuenta", description: "Nombre, moneda, zona horaria" },
    ],
  },
  {
    title: "Personalización",
    links: [
      { href: "/categories", icon: Tags, label: "Categorías", description: "Organizar categorías y presupuestos" },
      { href: "/destinatarios", icon: Contact, label: "Destinatarios", description: "Comercios y personas" },
    ],
  },
  {
    title: "Acerca de",
    links: [
      { href: "/settings/analytics", icon: Info, label: "Analíticas", description: "Datos de uso" },
    ],
  },
];

export function MobileSettings() {
  return (
    <div className="space-y-6">
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            {section.title}
          </h3>
          <div className="rounded-xl border divide-y">
            {section.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between px-4 py-3.5 active:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <link.icon className="size-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{link.label}</p>
                    {link.description && (
                      <p className="text-xs text-muted-foreground">{link.description}</p>
                    )}
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
