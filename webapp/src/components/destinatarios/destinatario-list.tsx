"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Search, ArrowUpDown, Plus, Contact } from "lucide-react";
import { CreateDestinatarioDialog } from "./create-destinatario-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MergeDialog } from "./merge-dialog";
import type { CategoryWithChildren } from "@/types/domain";

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
  categories: CategoryWithChildren[];
}

export function DestinatarioList({
  destinatarios,
  categoryMap,
  categories,
}: DestinatarioListProps) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("name");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedItems = useMemo(
    () =>
      destinatarios
        .filter((d) => selectedIds.has(d.id))
        .map((d) => ({ id: d.id, name: d.name })),
    [destinatarios, selectedIds]
  );

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
        <CreateDestinatarioDialog categories={categories} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search + Sort + Create */}
      <div className="flex flex-col gap-3 rounded-2xl border border-white/6 bg-z-surface-2/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:flex-row sm:items-center sm:justify-between">
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
          {selectedIds.size >= 2 && (
            <MergeDialog selected={selectedItems} onMerged={clearSelection} />
          )}
          {selectedIds.size > 0 && (
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Deseleccionar ({selectedIds.size})
            </Button>
          )}
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
              <SelectItem value="most_used">Mas usado</SelectItem>
              <SelectItem value="recent">Mas reciente</SelectItem>
            </SelectContent>
          </Select>
          <CreateDestinatarioDialog
            categories={categories}
            trigger={
              <Button size="sm" className="hidden bg-z-brass text-z-ink hover:bg-z-brass/90 sm:inline-flex">
                <Plus className="size-4 mr-2" />
                Crear
              </Button>
            }
          />
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
        <div className="overflow-hidden rounded-2xl border border-white/6 bg-z-surface-2/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] divide-y divide-white/6">
          {filtered.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-2 px-4 py-3 transition-colors hover:bg-white/5"
            >
              <Checkbox
                checked={selectedIds.has(d.id)}
                onCheckedChange={() => toggleSelect(d.id)}
                className="shrink-0"
              />
              <Link
                href={`/destinatarios/${d.id}`}
                className="flex items-center justify-between gap-4 flex-1 min-w-0"
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
            </div>
          ))}
        </div>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {filtered.map((d) => (
          <div key={d.id} className="relative">
            <div className="absolute left-3 top-4 z-10">
              <Checkbox
                checked={selectedIds.has(d.id)}
                onCheckedChange={() => toggleSelect(d.id)}
              />
            </div>
            <Link
              href={`/destinatarios/${d.id}`}
              className="block rounded-xl border border-white/6 bg-z-surface-2/80 p-4 pl-10 active:bg-white/5"
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
          </div>
        ))}
      </div>
    </div>
  );
}
