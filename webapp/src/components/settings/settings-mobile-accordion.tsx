"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

export function SettingsMobileAccordion({ sections }: { sections: SettingsSection[] }) {
  const [openId, setOpenId] = useState<string>(sections[0]?.id ?? "");
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const match = sections.find((s) => s.id === hash);
    if (!match) return;
    setOpenId(match.id);
    // Defer scroll so the accordion has expanded before we scroll into view.
    requestAnimationFrame(() => {
      sectionRefs.current[match.id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [sections]);

  return (
    <div className="space-y-2">
      {sections.map((section) => {
        const isOpen = openId === section.id;
        return (
          <Collapsible
            key={section.id}
            open={isOpen}
            onOpenChange={(open) => setOpenId(open ? section.id : "")}
          >
            <div
              id={section.id}
              ref={(el) => {
                sectionRefs.current[section.id] = el;
              }}
              className="scroll-mt-16 rounded-xl border border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
            >
              <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/6 bg-black/10">
                    {section.icon}
                  </div>
                  <span className="font-semibold">{section.title}</span>
                </div>
                <ChevronDown
                  className={cn(
                    "size-4 text-muted-foreground transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t border-white/6 px-4 pb-4 pt-3">
                  {section.children}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}
