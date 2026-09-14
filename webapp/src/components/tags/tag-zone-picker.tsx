"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronsUpDown, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TagChip } from "./tag-chip";
import { cn } from "@/lib/utils";
import { SECTION_EYEBROW_CLASS } from "@/lib/constants/styles";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  createTag,
  addTagToEntity,
  removeTagFromEntity,
  getTagsForEntity,
  getRecentTags,
} from "@/actions/tags";
import { useTagGroups } from "@/components/providers/app-data-provider";
import { UNGROUPED_TAG_GROUP_ID } from "@/lib/constants/tags";
import { generateSlug } from "@/lib/validators/tags";
import { toast } from "sonner";
import type { Tag, TagGroupWithTags, TaggableEntity } from "@/types/domain";

interface TagZonePickerProps {
  /**
   * Entity mode: tags are read from / written to the junction table for this
   * entity on every add/remove. Omit both (and pass `selectedTagIds`) for a
   * controlled selection that doesn't touch the server — e.g. picking tags
   * for a record that doesn't exist yet.
   */
  entityType?: TaggableEntity;
  entityId?: string;
  /** Controlled selection — when defined, the picker never calls entity actions. */
  selectedTagIds?: string[];
  onSelectedTagIdsChange?: (ids: string[]) => void;
  placeholder?: string;
  triggerClassName?: string;
  /** Render as a small icon button instead of a combobox */
  compact?: boolean;
  variant?: "popover" | "dialog" | "drawer";
  /** External open control — when defined, suppresses internal state. */
  controlledOpen?: boolean;
  onControlledOpenChange?: (open: boolean) => void;
  /** Hide the default trigger button — parent opens via controlledOpen. */
  hideTrigger?: boolean;
}

export function TagZonePicker({
  entityType,
  entityId,
  selectedTagIds,
  onSelectedTagIdsChange,
  placeholder = "Etiquetas",
  triggerClassName,
  compact = false,
  variant: variantProp,
  controlledOpen,
  onControlledOpenChange,
  hideTrigger = false,
}: TagZonePickerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (isControlled) {
      onControlledOpenChange?.(next);
    } else {
      setInternalOpen(next);
    }
  };
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const variant = variantProp ?? (isDesktop ? "popover" : "drawer");

  const contextTagGroups = useTagGroups();
  const isControlledSelection = selectedTagIds !== undefined;
  const [entityTags, setEntityTags] = useState<Tag[]>([]);
  const [tagGroups, setTagGroups] = useState<TagGroupWithTags[]>(contextTagGroups);
  const [search, setSearch] = useState("");
  const [recentTags, setRecentTags] = useState<Array<{ id: string; name: string; color: string | null }>>([]);
  const [isPending, startTransition] = useTransition();

  // Sync from context when it changes (e.g. after revalidation)
  useEffect(() => {
    setTagGroups(contextTagGroups);
  }, [contextTagGroups]);

  // Load per-entity tags and recents on open
  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }
    if (!isControlledSelection && entityType && entityId) {
      getTagsForEntity(entityType, entityId).then((tags) => setEntityTags(tags));
    }
    getRecentTags(5).then(setRecentTags);
  }, [open, entityType, entityId, isControlledSelection]);

  const allTags = useMemo(
    () =>
      tagGroups.flatMap((g) =>
        g.tags.map((t) => ({ ...t, groupColor: g.color, groupName: g.name }))
      ),
    [tagGroups]
  );

  const currentTags = useMemo<Tag[]>(() => {
    if (!isControlledSelection) return entityTags;
    const selected = new Set(selectedTagIds);
    return allTags.filter((t) => selected.has(t.id));
  }, [isControlledSelection, entityTags, selectedTagIds, allTags]);

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
    setSearch("");
    if (isControlledSelection) {
      if (!currentTagIds.has(tag.id)) {
        onSelectedTagIdsChange?.([...(selectedTagIds ?? []), tag.id]);
      }
      return;
    }
    if (!entityType || !entityId) return;
    const prev = entityTags;
    setEntityTags([...prev, tag]);
    startTransition(async () => {
      const result = await addTagToEntity(tag.id, entityType, entityId);
      if (!result.success) {
        setEntityTags(prev);
        toast.error("Error al agregar etiqueta");
      }
    });
  }

  function handleRemove(tagId: string) {
    if (isControlledSelection) {
      onSelectedTagIdsChange?.((selectedTagIds ?? []).filter((id) => id !== tagId));
      return;
    }
    if (!entityType || !entityId) return;
    const prev = entityTags;
    setEntityTags(prev.filter((t) => t.id !== tagId));
    startTransition(async () => {
      const result = await removeTagFromEntity(tagId, entityType, entityId);
      if (!result.success) {
        setEntityTags(prev);
        toast.error("Error al remover etiqueta");
      }
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

      {/* Recent tags — collapse when searching */}
      {recentTags.length > 0 && !search && (
        <div className="px-3 pb-1">
          <div className={cn(SECTION_EYEBROW_CLASS, "mb-1")}>Recientes</div>
          <div className="flex flex-wrap gap-1">
            {recentTags
              .filter((rt) => !currentTagIds.has(rt.id))
              .map((rt) => (
                <button
                  key={rt.id}
                  type="button"
                  onClick={() => {
                    const fullTag = allTags.find((t) => t.id === rt.id);
                    if (fullTag) handleAdd(fullTag);
                  }}
                  disabled={isPending}
                  className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-white/[0.06]"
                >
                  {rt.name}
                </button>
              ))}
          </div>
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
          disabled={isPending}
        />
      </div>

      {/* Tag list */}
      <div className="max-h-[50dvh] overflow-y-auto px-1 pb-2">
        {[...grouped.entries()].map(([groupName, groupTags]) => (
          <div key={groupName}>
            <div className="flex items-center justify-between px-3 py-1.5">
              <span className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                {groupName}
              </span>
              <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[0.6rem] tabular-nums text-muted-foreground/60">
                {groupTags.length}
              </span>
            </div>
            {groupTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => handleAdd(tag)}
                disabled={isPending}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-white/5"
              >
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: tag.groupColor ?? tag.color ?? "rgba(255,255,255,0.15)" }}
                />
                <span>{tag.name}</span>
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

        {filtered.length === 0 && !canCreate && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Hash className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {search ? "Sin resultados" : "No hay etiquetas disponibles"}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────

  if (variant === "popover") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        {!hideTrigger && <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>}
        {/* Mobile hardening — see CategoryZonePicker: a popover opened inside a
            vaul Drawer loses touch scroll without these. */}
        <PopoverContent
          className="w-[300px] max-w-[min(22rem,calc(100vw-2rem))] p-0 overscroll-contain touch-pan-y"
          align="start"
          side="bottom"
          sideOffset={8}
          collisionPadding={16}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {body}
        </PopoverContent>
      </Popover>
    );
  }

  if (variant === "dialog") {
    return (
      <>
        {!hideTrigger && triggerButton}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="flex max-h-[70vh] w-full max-w-sm flex-col gap-0 overflow-hidden p-0">
            <DialogHeader className="border-b px-4 py-3">
              <DialogTitle className="flex items-center gap-2">
                <Hash className="size-4 text-z-brass" />
                Etiquetas
              </DialogTitle>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {body}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // variant === "drawer"
  return (
    <>
      {!hideTrigger && triggerButton}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Hash className="size-4 text-z-brass" />
              Etiquetas
            </DrawerTitle>
          </DrawerHeader>
          <DrawerBody className="px-2">
            {body}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}
