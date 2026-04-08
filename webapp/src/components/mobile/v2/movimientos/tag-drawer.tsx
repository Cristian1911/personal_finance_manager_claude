"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { Hash, Loader2 } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { TagChip } from "@/components/tags/tag-chip";
import {
  createTag,
  addTagToEntity,
  removeTagFromEntity,
  getTagsForEntity,
  getTagGroups,
} from "@/actions/tags";
import { UNGROUPED_TAG_GROUP_ID } from "@/lib/constants/tags";
import { generateSlug } from "@/lib/validators/tags";
import { toast } from "sonner";
import type { Tag, TagGroupWithTags } from "@/types/domain";

interface TagDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string;
}

export function TagDrawer({
  open,
  onOpenChange,
  transactionId,
}: TagDrawerProps) {
  const [search, setSearch] = useState("");
  const [currentTags, setCurrentTags] = useState<Tag[]>([]);
  const [localTagGroups, setLocalTagGroups] = useState<TagGroupWithTags[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Lazy-load tag groups and current tags when drawer opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      getTagGroups(),
      getTagsForEntity("transaction", transactionId),
    ])
      .then(([groupsResult, tags]) => {
        if (groupsResult.success) {
          setLocalTagGroups(groupsResult.data);
        }
        setCurrentTags(tags);
      })
      .finally(() => setLoading(false));
  }, [open, transactionId]);

  // Reset search on close
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const allTags = useMemo(
    () =>
      localTagGroups.flatMap((g) =>
        g.tags.map((t) => ({ ...t, groupColor: g.color, groupName: g.name }))
      ),
    [localTagGroups]
  );

  const currentTagIds = useMemo(
    () => new Set(currentTags.map((t) => t.id)),
    [currentTags]
  );

  const filtered = useMemo(() => {
    const available = allTags.filter((t) => !currentTagIds.has(t.id));
    if (!search) return available;
    const q = search.toLowerCase();
    return available.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.slug.includes(generateSlug(search))
    );
  }, [allTags, currentTagIds, search]);

  // Group filtered tags by group name
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const t of filtered) {
      const key = t.groupName ?? "Sin grupo";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [filtered]);

  const canCreate = useMemo(
    () =>
      search.length > 0 &&
      !allTags.some((t) => t.slug === generateSlug(search)),
    [allTags, search]
  );

  const tagGroupMap = useMemo(
    () => new Map(localTagGroups.map((g) => [g.id, g])),
    [localTagGroups]
  );

  function handleAdd(tag: Tag) {
    const updated = [...currentTags, tag];
    setCurrentTags(updated);
    setSearch("");
    startTransition(async () => {
      await addTagToEntity(tag.id, "transaction", transactionId);
    });
  }

  function handleRemove(tagId: string) {
    setCurrentTags((prev) => prev.filter((t) => t.id !== tagId));
    startTransition(async () => {
      await removeTagFromEntity(tagId, "transaction", transactionId);
    });
  }

  async function handleCreate() {
    const name = search.trim();
    if (!name) return;
    const fd = new FormData();
    fd.set("name", name);
    const result = await createTag(fd);
    if (result.success) {
      const newTag: Tag = {
        id: result.data.id,
        user_id: null,
        group_id: null,
        name,
        slug: generateSlug(name),
        color: null,
        is_system: false,
        display_order: 0,
        created_at: new Date().toISOString(),
      };
      // Add to local tag groups
      setLocalTagGroups((prev) => {
        const ungrouped = prev.find(
          (g) => g.id === UNGROUPED_TAG_GROUP_ID || g.name === "Sin grupo"
        );
        if (ungrouped) {
          return prev.map((g) =>
            g.id === ungrouped.id ? { ...g, tags: [...g.tags, newTag] } : g
          );
        }
        return [
          ...prev,
          {
            id: UNGROUPED_TAG_GROUP_ID,
            user_id: null,
            name: "Sin grupo",
            color: null,
            is_system: false,
            display_order: 9999,
            created_at: new Date().toISOString(),
            tags: [newTag],
          },
        ];
      });
      handleAdd(newTag);
      toast.success(`Etiqueta "${name}" creada`);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <Hash className="size-4 text-z-brass" />
            Etiquetas
          </DrawerTitle>
        </DrawerHeader>

        {/* Current tags */}
        {currentTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-2">
            {currentTags.map((tag) => (
              <TagChip
                key={tag.id}
                tag={tag}
                groupColor={
                  tag.group_id
                    ? tagGroupMap.get(tag.group_id)?.color
                    : null
                }
                onRemove={() => handleRemove(tag.id)}
                size="sm"
              />
            ))}
          </div>
        )}

        {/* Search */}
        <div className="px-4 pb-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canCreate) {
                e.preventDefault();
                handleCreate();
              }
            }}
            placeholder="Buscar o crear etiqueta..."
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-z-brass/40"
            autoFocus
            disabled={isPending}
          />
        </div>

        {/* Tag list */}
        <div className="max-h-[50dvh] overflow-y-auto px-4 pb-4">
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && (
            <>
              {[...grouped.entries()].map(([groupName, groupTags]) => (
                <div key={groupName}>
                  <div className="px-1 py-1.5 text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                    {groupName}
                  </div>
                  {groupTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleAdd(tag)}
                      disabled={isPending}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-white/5"
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              ))}

              {canCreate && (
                <div className="border-t border-white/10 pt-2 mt-1">
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={isPending}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-white/5"
                  >
                    Crear: &quot;
                    <span className="text-z-brass">{search.trim()}</span>
                    &quot; ↵
                  </button>
                </div>
              )}

              {!loading && filtered.length === 0 && !canCreate && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {search
                    ? "Sin resultados"
                    : currentTags.length === allTags.length
                      ? "Todas las etiquetas asignadas"
                      : "No hay etiquetas disponibles"}
                </p>
              )}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
