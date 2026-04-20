"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import { SettingsNavRow } from "./settings-nav-row";
import { SettingsSection } from "./settings-section";

export interface SettingsNavItem {
  key: string;
  title: string;
  meta?: string;
  href: string;
  tone?: "default" | "destructive";
  keywords?: string[];
}

interface SettingsSectionData {
  label: string;
  items: SettingsNavItem[];
}

interface SettingsNavigationListProps {
  sections: SettingsSectionData[];
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function SettingsNavigationList({ sections }: SettingsNavigationListProps) {
  const [query, setQuery] = useState("");

  const filteredSections = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return sections;
    return sections
      .map((section) => {
        const items = section.items.filter((item) => {
          const haystack = [item.title, item.meta ?? "", ...(item.keywords ?? [])]
            .map(normalize)
            .join(" ");
          return haystack.includes(needle);
        });
        return { ...section, items };
      })
      .filter((section) => section.items.length > 0);
  }, [query, sections]);

  const hasResults = filteredSections.length > 0;

  return (
    <div className="space-y-6">
      <label
        className={cn(
          PANEL_INSET_CLASS,
          "flex items-center gap-2 px-3 py-2.5 transition-colors focus-within:border-z-brass/40"
        )}
      >
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar ajustes…"
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </label>

      {hasResults ? (
        filteredSections.map((section) => (
          <SettingsSection key={section.label} label={section.label}>
            {section.items.map((item) => (
              <SettingsNavRow
                key={item.key}
                title={item.title}
                meta={item.meta}
                href={item.href}
                tone={item.tone}
              />
            ))}
          </SettingsSection>
        ))
      ) : (
        <p
          className={cn(
            PANEL_INSET_CLASS,
            "px-4 py-6 text-center text-sm text-muted-foreground"
          )}
        >
          Sin coincidencias para &ldquo;{query}&rdquo;
        </p>
      )}
    </div>
  );
}
