"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronsUpDown, Hash, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TagChip } from "./tag-chip";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  createTag,
  addTagToEntity,
  removeTagFromEntity,
  getTagsForEntity,
  getTagGroups,
} from "@/actions/tags";
import { UNGROUPED_TAG_GROUP_ID } from "@/lib/constants/tags";
import { generateSlug } from "@/lib/validators/tags";
import type { Tag, TagGroupWithTags, TaggableEntity } from "@/types/domain";

interface TagZonePickerProps {
  entityType: TaggableEntity;
  entityId: string;
  placeholder?: string;
  triggerClassName?: string;
  /** Render as a small icon button instead of a combobox */
  compact?: boolean;
  variant?: "popover" | "drawer";
}

export function TagZonePicker({
  entityType,
  entityId,
  placeholder = "Etiquetas",
  triggerClassName,
  compact = false,
  variant: variantProp,
}: TagZonePickerProps) {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const variant = variantProp ?? (isDesktop ? "popover" : "drawer");

  const [currentTags, setCurrentTags] = useState<Tag[]>([]);
  const [tagGroups, setTagGroups] = useState<TagGroupWithTags[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  // Load data on open — groups cached, current tags always refreshed
  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }
    setLoading(true);
    const groupsPromise = groupsLoaded
      ? Promise.resolve(null)
      : getTagGroups();
    Promise.all([groupsPromise, getTagsForEntity(entityType, entityId)])
      .then(([groupsResult, tags]) => {
        if (groupsResult?.success) {
          setTagGroups(groupsResult.data);
          setGroupsLoaded(true);
        }
        setCurrentTags(tags);
      })
      .finally(() => setLoading(false));
  }, [open, entityType, entityId, groupsLoaded]);

  const allTags = useMemo(
    () =>
      tagGroups.flatMap((g) =>
        g.tags.map((t) => ({ ...t, groupColor: g.color, groupName: g.name }))
      ),
    [tagGroups]
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
    () => search.length > 0 && !allTags.some((t) => t.slug === generateSlug(search)),
    [allTags, search]
  );

  const tagGroupMap = useMemo(
    () => new Map(tagGroups.map((g) => [g.id, g])),
    [tagGroups]
  );

  function handleAdd(tag: Tag) {
    setCurrentTags((prev) => [...prev, tag]);
    setSearch("");
    startTransition(async () => {
      await addTagToEntity(tag.id, entityType, entityId);
    });
  }

  function handleRemove(tagId: string) {
    setCurrentTags((prev) => prev.filter((t) => t.id !== tagId));
    startTransition(async () => {
      await removeTagFromEntity(tagId, entityType, entityId);
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
      setTagGroups((prev) => {
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
    }
  }

  // ── Trigger ──────────────────────────────────────────────────────────────

  const tagCount = currentTags.length;
  const triggerButton = compact ? (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        "inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.06]",
        triggerClassName
      )}
    >
      <Hash className="size-3" />
    </button>
  ) : (
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className={cn(
        "justify-between font-normal",
        tagCount === 0 && "text-muted-foreground",
        triggerClassName
      )}
      {...(variant !== "popover" ? { onClick: () => setOpen(true) } : {})}
    >
      {tagCount > 0 ? (
        <span className="flex items-center gap-1.5 truncate">
          <Hash className="size-3 shrink-0" />
          <span className="truncate">
            {tagCount === 1 ? currentTags[0].name : `${tagCount} etiquetas`}
          </span>
        </span>
      ) : (
        <span className="truncate">{placeholder}</span>
      )}
      <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
    </Button>
  );

  // ── Body ─────────────────────────────────────────────────────────────────

  const body = (
    <div className="flex flex-col">
      {/* Current tags */}
      {currentTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pt-3 pb-1">
          {currentTags.map((tag) => (
            <TagChip
              key={tag.id}
              tag={tag}
              groupColor={tag.group_id ? tagGroupMap.get(tag.group_id)?.color : null}
              onRemove={() => handleRemove(tag.id)}
              size="sm"
            />
          ))}
        </div>
      )}

      {/* Search */}
      <div className="p-3 pt-2">
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
      <div className="max-h-[50dvh] overflow-y-auto px-1 pb-2">
        {loading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && (
          <>
            {[...grouped.entries()].map(([groupName, groupTags]) => (
              <div key={groupName}>
                <div className="px-3 py-1.5 text-[0.65rem] uppercase tracking-wider text-muted-foreground">
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
                  Crear: &quot;<span className="text-z-brass">{search.trim()}</span>&quot; ↵
                </button>
              </div>
            )}

            {!loading && filtered.length === 0 && !canCreate && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {search ? "Sin resultados" : "No hay etiquetas disponibles"}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────

  if (variant === "popover") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start" sideOffset={8}>
          {body}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <>
      {triggerButton}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Hash className="size-4 text-z-brass" />
              Etiquetas
            </DrawerTitle>
          </DrawerHeader>
          {body}
        </DrawerContent>
      </Drawer>
    </>
  );
}
