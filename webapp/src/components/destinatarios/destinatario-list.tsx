"use client";

import { useMemo, useState, useCallback, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  ArrowUpDown,
  Plus,
  Contact,
  ChevronDown,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { CreateDestinatarioDialog } from "./create-destinatario-dialog";
import { MergeDialog } from "./merge-dialog";
import { TagChip } from "@/components/tags/tag-chip";
import { getTagsForEntity } from "@/actions/tags";
import { patchDestinatario } from "@/actions/destinatarios";
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { chipBackground, zoneTextColor } from "@/lib/utils/zone-colors";
import { formatCurrency } from "@/lib/utils/currency";
import type { CategoryWithChildren, Tag, TagGroupWithTags } from "@/types/domain";

// ── Types ────────────────────────────────────────────────────────────────────

type DestinatarioCardItem = {
  id: string;
  name: string;
  default_category_id: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  rule_count: number;
  transaction_count: number;
  avg_monthly_spend?: number;
};

type SortOption = "name" | "most_used" | "recent";

interface DestinatarioListProps {
  destinatarios: DestinatarioCardItem[];
  categoryMap: Record<string, string>;
  categories: CategoryWithChildren[];
  tagGroups?: TagGroupWithTags[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Find the parent category for a given category ID */
function findParentForCategory(
  categories: CategoryWithChildren[],
  categoryId: string | null,
): CategoryWithChildren | null {
  if (!categoryId) return null;
  for (const parent of categories) {
    if (parent.id === categoryId) return parent;
    if (parent.children.some((c) => c.id === categoryId)) return parent;
  }
  return null;
}

/** Get the display name for a category — prefers name_es */
function categoryDisplayName(
  categories: CategoryWithChildren[],
  categoryId: string | null,
): string | null {
  if (!categoryId) return null;
  for (const parent of categories) {
    if (parent.id === categoryId) return parent.name_es ?? parent.name;
    for (const child of parent.children) {
      if (child.id === categoryId) return child.name_es ?? child.name;
    }
  }
  return null;
}

// ── Component ────────────────────────────────────────────────────────────────

export function DestinatarioList({
  destinatarios,
  categoryMap,
  categories,
  tagGroups: _tagGroups,
}: DestinatarioListProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("name");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tagsCache, setTagsCache] = useState<Record<string, Tag[]>>({});
  const [tagsLoading, setTagsLoading] = useState<Set<string>>(new Set());

  // ── Derived: category pills ──────────────────────────────────────────────

  const categoryPills = useMemo(() => {
    // Collect parent categories that have at least one linked destinatario
    const parentIds = new Set<string>();
    for (const d of destinatarios) {
      if (!d.default_category_id) continue;
      const parent = findParentForCategory(categories, d.default_category_id);
      if (parent) parentIds.add(parent.id);
    }
    return categories.filter((c) => parentIds.has(c.id));
  }, [destinatarios, categories]);

  // ── Derived: filtered + sorted ───────────────────────────────────────────

  const filtered = useMemo(() => {
    let items = destinatarios;

    // Category filter
    if (categoryFilter) {
      const parent = categories.find((c) => c.id === categoryFilter);
      if (parent) {
        const allowedIds = new Set([
          parent.id,
          ...parent.children.map((c) => c.id),
        ]);
        items = items.filter(
          (d) => d.default_category_id && allowedIds.has(d.default_category_id),
        );
      }
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((d) => d.name.toLowerCase().includes(q));
    }

    // Sort within active/inactive groups
    const sortFn = (a: DestinatarioCardItem, b: DestinatarioCardItem) => {
      switch (sort) {
        case "most_used":
          return b.transaction_count - a.transaction_count;
        case "recent":
          return (
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
          );
        case "name":
        default:
          return a.name.localeCompare(b.name);
      }
    };

    const active = items.filter((d) => d.is_active).sort(sortFn);
    const inactive = items.filter((d) => !d.is_active).sort(sortFn);
    return [...active, ...inactive];
  }, [destinatarios, search, sort, categoryFilter, categories]);

  // ── Selection ────────────────────────────────────────────────────────────

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
    [destinatarios, selectedIds],
  );

  // ── Expand + lazy tag loading ────────────────────────────────────────────

  const toggleExpand = useCallback(
    (id: string) => {
      const nextId = expandedId === id ? null : id;
      setExpandedId(nextId);

      // Lazy-load tags if not already cached
      if (nextId && !tagsCache[nextId] && !tagsLoading.has(nextId)) {
        setTagsLoading((prev) => new Set(prev).add(nextId));
        getTagsForEntity("destinatario", nextId).then((tags) => {
          setTagsCache((prev) => ({ ...prev, [nextId]: tags }));
          setTagsLoading((prev) => {
            const next = new Set(prev);
            next.delete(nextId);
            return next;
          });
        });
      }
    },
    [expandedId, tagsCache, tagsLoading],
  );

  // ── Inline actions ───────────────────────────────────────────────────────

  const handleCategoryChange = useCallback(
    (destId: string, categoryId: string | null) => {
      startTransition(async () => {
        const result = await patchDestinatario(destId, {
          default_category_id: categoryId,
        });
        if (!result.success) {
          toast.error(result.error);
        } else {
          router.refresh();
        }
      });
    },
    [router, startTransition],
  );

  const handleToggleActive = useCallback(
    (destId: string, newActive: boolean) => {
      startTransition(async () => {
        const result = await patchDestinatario(destId, {
          is_active: newActive,
        });
        if (!result.success) {
          toast.error(result.error);
        } else {
          router.refresh();
        }
      });
    },
    [router, startTransition],
  );

  // ── Empty state ──────────────────────────────────────────────────────────

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
              <Button
                size="sm"
                className="hidden bg-z-brass text-z-ink hover:bg-z-brass/90 sm:inline-flex"
              >
                <Plus className="size-4 mr-2" />
                Crear
              </Button>
            }
          />
        </div>
      </div>

      {/* Category filter pills */}
      {categoryPills.length > 0 && (
        <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-x-visible">
          <button
            type="button"
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              categoryFilter === null
                ? "bg-foreground text-background"
                : "border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10",
            )}
            onClick={() => setCategoryFilter(null)}
          >
            Todos
          </button>
          {categoryPills.map((cat) => {
            const isActive = categoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "ring-1 ring-offset-1 ring-offset-background"
                    : "hover:opacity-80",
                )}
                style={{
                  backgroundColor: chipBackground(cat.color),
                  color: zoneTextColor(cat.color),
                  ...(isActive
                    ? { ringColor: zoneTextColor(cat.color) }
                    : {}),
                }}
                onClick={() =>
                  setCategoryFilter(isActive ? null : cat.id)
                }
              >
                {cat.name_es ?? cat.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Results count */}
      {search.trim() && (
        <p className="text-sm text-muted-foreground">
          {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* No search results */}
      {filtered.length === 0 && (search.trim() || categoryFilter) && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">
            {search.trim()
              ? `No se encontraron destinatarios para "${search}"`
              : "No hay destinatarios en esta categoría"}
          </p>
        </div>
      )}

      {/* Card grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((d) => {
            const isExpanded = expandedId === d.id;
            const parent = findParentForCategory(
              categories,
              d.default_category_id,
            );
            const color = parent?.color ?? "#6b7280";
            const catName =
              categoryDisplayName(categories, d.default_category_id) ??
              categoryMap[d.default_category_id ?? ""] ??
              null;
            const tags = tagsCache[d.id];
            const isLoadingTags = tagsLoading.has(d.id);

            return (
              <div
                key={d.id}
                className={cn(
                  "rounded-2xl border border-white/6 bg-z-surface-2/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-all",
                  !d.is_active && "opacity-60",
                )}
              >
                {/* Card header — clickable to expand */}
                <div
                  role="button"
                  tabIndex={0}
                  className="w-full cursor-pointer p-4 text-left"
                  onClick={() => toggleExpand(d.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleExpand(d.id); } }}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <div
                      className="pt-0.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedIds.has(d.id)}
                        onCheckedChange={() => toggleSelect(d.id)}
                      />
                    </div>

                    {/* Avatar */}
                    <div
                      className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                      style={{
                        backgroundColor: chipBackground(color),
                        color: zoneTextColor(color),
                      }}
                    >
                      {d.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{d.name}</span>
                        <ChevronDown
                          className={cn(
                            "size-4 shrink-0 text-muted-foreground transition-transform",
                            isExpanded && "rotate-180",
                          )}
                        />
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                        {catName ? (
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{
                              backgroundColor: chipBackground(color),
                              color: zoneTextColor(color),
                            }}
                          >
                            {catName}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Sin categoría
                          </span>
                        )}
                        {(d.avg_monthly_spend ?? 0) > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(d.avg_monthly_spend!, "COP")}/mes
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          {d.rule_count} regla{d.rule_count !== 1 ? "s" : ""}
                        </span>
                        {d.is_active ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px] bg-emerald-500/15 text-emerald-400 border-0"
                          >
                            Activo
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="text-[10px]"
                          >
                            Inactivo
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded section */}
                {isExpanded && (
                  <div className="border-t border-white/6 px-4 pb-4 pt-3 space-y-3">
                    {/* Tags */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isLoadingTags ? (
                        <span className="text-xs text-muted-foreground">
                          Cargando etiquetas...
                        </span>
                      ) : tags && tags.length > 0 ? (
                        tags.map((tag) => (
                          <TagChip key={tag.id} tag={tag} size="sm" />
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Sin etiquetas
                        </span>
                      )}
                    </div>

                    {/* Quick actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="h-8 border-white/8 bg-black/10 text-z-sage-light"
                      >
                        <Link href={`/destinatarios/${d.id}`}>
                          <Pencil className="size-3.5 mr-1.5" />
                          Editar
                        </Link>
                      </Button>

                      {/* Inline category picker */}
                      <CategoryZonePicker
                        categories={categories}
                        value={d.default_category_id}
                        onValueChange={(id) =>
                          handleCategoryChange(d.id, id)
                        }
                        variant="popover"
                        placeholder="Categoría"
                        triggerClassName="h-8 text-xs border-white/8 bg-black/10 text-z-sage-light"
                      />

                      {/* Active toggle */}
                      <div className="flex items-center gap-2 ml-auto">
                        <span className="text-xs text-muted-foreground">
                          {d.is_active ? "Activo" : "Inactivo"}
                        </span>
                        <Switch
                          checked={d.is_active}
                          onCheckedChange={(checked) =>
                            handleToggleActive(d.id, checked)
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
