"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { createTag, addTagToEntity, removeTagFromEntity } from "@/actions/tags";
import { UNGROUPED_TAG_GROUP_ID } from "@/lib/constants/tags";
import { generateSlug } from "@/lib/validators/tags";
import { TagChip } from "./tag-chip";
import type { Tag, TagGroupWithTags, TaggableEntity } from "@/types/domain";

interface TagPickerProps {
  entityType: TaggableEntity;
  entityId: string;
  currentTags: Tag[];
  allTagGroups: TagGroupWithTags[];
  onTagsChange?: (tags: Tag[]) => void;
}

export function TagPicker({
  entityType,
  entityId,
  currentTags,
  allTagGroups,
  onTagsChange,
}: TagPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tags, setTags] = useState<Tag[]>(currentTags);
  const [localTagGroups, setLocalTagGroups] = useState(allTagGroups);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync when server-fetched props change (e.g. after navigation)
  useEffect(() => {
    setLocalTagGroups(allTagGroups);
  }, [allTagGroups]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const allTags = localTagGroups.flatMap((g) =>
    g.tags.map((t) => ({ ...t, groupColor: g.color, groupName: g.name }))
  );

  const currentTagIds = new Set(tags.map((t) => t.id));
  const filtered = allTags.filter(
    (t) =>
      !currentTagIds.has(t.id) &&
      (t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.slug.includes(generateSlug(search)))
  );

  // Group filtered tags by group name
  const grouped = new Map<string, typeof filtered>();
  for (const t of filtered) {
    const key = t.groupName ?? "Sin grupo";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(t);
  }

  const canCreate =
    search.length > 0 && !allTags.some((t) => t.slug === generateSlug(search));

  function handleAdd(tag: Tag) {
    const updated = [...tags, tag];
    setTags(updated);
    onTagsChange?.(updated);
    setSearch("");
    startTransition(async () => {
      await addTagToEntity(tag.id, entityType, entityId);
    });
  }

  function handleRemove(tagId: string) {
    const updated = tags.filter((t) => t.id !== tagId);
    setTags(updated);
    onTagsChange?.(updated);
    startTransition(async () => {
      await removeTagFromEntity(tagId, entityType, entityId);
    });
  }

  async function handleCreate() {
    const fd = new FormData();
    fd.set("name", search.trim());
    const result = await createTag(fd);
    if (result.success) {
      const newTag: Tag = {
        id: result.data.id,
        user_id: null,
        group_id: null,
        name: search.trim(),
        slug: generateSlug(search),
        color: null,
        is_system: false,
        display_order: 0,
        created_at: new Date().toISOString(),
      };
      // Add to local tag groups so it appears in the dropdown for future picks
      setLocalTagGroups((prev) => {
        const ungrouped = prev.find((g) => g.id === UNGROUPED_TAG_GROUP_ID || g.name === "Sin grupo");
        if (ungrouped) {
          return prev.map((g) =>
            g.id === ungrouped.id ? { ...g, tags: [...g.tags, newTag] } : g
          );
        }
        // No ungrouped group exists — append one
        return [...prev, { id: UNGROUPED_TAG_GROUP_ID, user_id: null, name: "Sin grupo", color: null, is_system: false, display_order: 9999, created_at: new Date().toISOString(), tags: [newTag] }];
      });
      handleAdd(newTag);
    }
  }

  const tagGroupMap = new Map(localTagGroups.map((g) => [g.id, g]));

  return (
    <div className="space-y-2" ref={dropdownRef}>
      {/* Applied tags */}
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <TagChip
            key={tag.id}
            tag={tag}
            groupColor={tag.group_id ? tagGroupMap.get(tag.group_id)?.color : null}
            onRemove={() => handleRemove(tag.id)}
            size="sm"
          />
        ))}
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className="rounded-full border border-dashed border-white/20 px-3 py-0.5 text-xs text-muted-foreground hover:bg-white/5"
        >
          + Agregar
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="rounded-lg border border-white/15 bg-z-surface-2 shadow-lg">
          <div className="p-2">
            <input
              ref={inputRef}
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
              className="w-full rounded-md border-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              disabled={isPending}
            />
          </div>

          <div className="max-h-48 overflow-y-auto border-t border-white/10">
            {[...grouped.entries()].map(([groupName, groupTags]) => (
              <div key={groupName}>
                <div className="px-3 py-1 text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                  {groupName}
                </div>
                {groupTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleAdd(tag)}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-white/5"
                    disabled={isPending}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            ))}

            {canCreate && (
              <div className="border-t border-white/10">
                <button
                  type="button"
                  onClick={handleCreate}
                  className="w-full px-3 py-1.5 text-left text-sm text-muted-foreground hover:bg-white/5"
                  disabled={isPending}
                >
                  Crear: &quot;<span className="text-indigo-400">{search.trim()}</span>&quot; ↵
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
