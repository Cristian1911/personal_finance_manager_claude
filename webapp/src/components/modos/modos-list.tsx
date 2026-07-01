"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { chipToggleClass } from "@/lib/constants/styles";
import type { Modo } from "@/types/domain";
import { ModoCard } from "./modo-card";

type Segment = "todos" | "activos" | "pasados";

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "activos", label: "Activos" },
  { key: "pasados", label: "Pasados" },
];

export function ModosList({ modos }: { modos: Modo[] }) {
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<Segment>("todos");
  // ISO date (local) for comparing against date_to strings — both "YYYY-MM-DD".
  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return modos.filter((m) => {
      if (q && !m.name.toLowerCase().includes(q)) return false;
      if (segment === "activos" && m.date_to < today) return false;
      if (segment === "pasados" && m.date_to >= today) return false;
      return true;
    });
  }, [modos, query, segment, today]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar modo por nombre..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex gap-1.5">
        {SEGMENTS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSegment(s.key)}
            aria-pressed={segment === s.key}
            className={chipToggleClass(segment === s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground">Ningún modo coincide con el filtro.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((m) => (
            <ModoCard key={m.id} modo={m} />
          ))}
        </div>
      )}
    </div>
  );
}
