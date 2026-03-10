"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ArrowUpDown, Plus, Contact } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DestinatarioItem = {
  id: string;
  name: string;
  default_category_id: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  rule_count: number;
  transaction_count: number;
};

type SortOption = "name" | "most_used" | "recent";

interface DestinatarioListProps {
  destinatarios: DestinatarioItem[];
  categoryMap: Record<string, string>;
}

export function DestinatarioList({
  destinatarios,
  categoryMap,
}: DestinatarioListProps) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("name");

  const filtered = useMemo(() => {
    let items = destinatarios;

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((d) => d.name.toLowerCase().includes(q));
    }

    // Sort
    switch (sort) {
      case "most_used":
        items = [...items].sort(
          (a, b) => b.transaction_count - a.transaction_count
        );
        break;
      case "recent":
        items = [...items].sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        );
        break;
      case "name":
      default:
        items = [...items].sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return items;
  }, [destinatarios, search, sort]);

  // Empty state
  if (destinatarios.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Contact className="size-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-2">
          No tienes destinatarios.
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          Importa transacciones o crea uno manualmente.
        </p>
        <Button asChild>
          <Link href="/destinatarios/nuevo">
            <Plus className="size-4 mr-2" />
            Crear destinatario
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + Sort + Create */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar destinatario..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={sort}
            onValueChange={(v) => setSort(v as SortOption)}
          >
            <SelectTrigger className="w-[180px]">
              <ArrowUpDown className="size-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Nombre</SelectItem>
              <SelectItem value="most_used">Más usado</SelectItem>
              <SelectItem value="recent">Más reciente</SelectItem>
            </SelectContent>
          </Select>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/destinatarios/nuevo">
              <Plus className="size-4 mr-2" />
              Crear
            </Link>
          </Button>
        </div>
      </div>

      {/* Results count */}
      {search.trim() && (
        <p className="text-sm text-muted-foreground">
          {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* No search results */}
      {filtered.length === 0 && search.trim() && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">
            No se encontraron destinatarios para &quot;{search}&quot;
          </p>
        </div>
      )}

      {/* Desktop list */}
      <div className="hidden sm:block">
        <div className="rounded-lg border divide-y">
          {filtered.map((d) => (
            <Link
              key={d.id}
              href={`/destinatarios/${d.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{d.name}</span>
                  {!d.is_active && (
                    <Badge variant="secondary" className="text-[10px]">
                      Inactivo
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {d.default_category_id && categoryMap[d.default_category_id]
                    ? categoryMap[d.default_category_id]
                    : "Sin categoría"}
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0 text-sm text-muted-foreground">
                <span>
                  {d.rule_count} regla{d.rule_count !== 1 ? "s" : ""}
                </span>
                <span>
                  {d.transaction_count} tx
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {filtered.map((d) => (
          <Link
            key={d.id}
            href={`/destinatarios/${d.id}`}
            className="block rounded-lg border bg-card p-4 active:bg-muted/50"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{d.name}</span>
                  {!d.is_active && (
                    <Badge variant="secondary" className="text-[10px]">
                      Inactivo
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {d.default_category_id && categoryMap[d.default_category_id]
                    ? categoryMap[d.default_category_id]
                    : "Sin categoría"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span>
                {d.rule_count} regla{d.rule_count !== 1 ? "s" : ""}
              </span>
              <span>
                {d.transaction_count} transaccion{d.transaction_count !== 1 ? "es" : ""}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
