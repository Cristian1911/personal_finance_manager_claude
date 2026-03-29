"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createTagGroup, deleteTagGroup, createTag, deleteTag } from "@/actions/tags";
import { TagChip } from "./tag-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TagGroupWithTags } from "@/types/domain";

interface TagManagerProps {
  tagGroups: TagGroupWithTags[];
}

export function TagManager({ tagGroups }: TagManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newGroupName, setNewGroupName] = useState("");
  const [newTagInputs, setNewTagInputs] = useState<Record<string, string>>({});

  const systemGroups = tagGroups.filter((g) => g.is_system);
  const userGroups = tagGroups.filter((g) => !g.is_system);

  function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    const fd = new FormData();
    fd.set("name", newGroupName.trim());
    startTransition(async () => {
      await createTagGroup(fd);
      setNewGroupName("");
      router.refresh();
    });
  }

  function handleDeleteGroup(id: string) {
    startTransition(async () => {
      await deleteTagGroup(id);
      router.refresh();
    });
  }

  function handleCreateTag(groupId: string | null) {
    const key = groupId ?? "__ungrouped";
    const name = newTagInputs[key]?.trim();
    if (!name) return;
    const fd = new FormData();
    fd.set("name", name);
    if (groupId) fd.set("group_id", groupId);
    startTransition(async () => {
      await createTag(fd);
      setNewTagInputs((prev) => ({ ...prev, [key]: "" }));
      router.refresh();
    });
  }

  function handleDeleteTag(id: string) {
    startTransition(async () => {
      await deleteTag(id);
      router.refresh();
    });
  }

  function renderGroup(group: TagGroupWithTags, editable: boolean) {
    const key = group.id;
    return (
      <div key={group.id} className="rounded-xl border border-white/10 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{group.name}</h3>
            {group.is_system && (
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[0.65rem] text-muted-foreground">
                sistema
              </span>
            )}
          </div>
          {editable && (
            <button
              type="button"
              onClick={() => handleDeleteGroup(group.id)}
              className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              disabled={isPending}
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {group.tags.map((tag) => (
            <TagChip
              key={tag.id}
              tag={tag}
              groupColor={group.color}
              onRemove={editable ? () => handleDeleteTag(tag.id) : undefined}
              size="sm"
            />
          ))}
          {editable && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateTag(group.id);
              }}
              className="flex items-center"
            >
              <Input
                value={newTagInputs[key] ?? ""}
                onChange={(e) => setNewTagInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder="+ agregar"
                className="h-7 w-28 border-dashed text-xs"
                disabled={isPending}
              />
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {systemGroups.map((g) => renderGroup(g, false))}
      {userGroups.map((g) => renderGroup(g, true))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleCreateGroup();
        }}
        className="flex gap-2"
      >
        <Input
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          placeholder="Nuevo grupo de etiquetas..."
          className="flex-1"
          disabled={isPending}
        />
        <Button type="submit" variant="outline" size="sm" disabled={isPending || !newGroupName.trim()}>
          <Plus className="mr-1 size-4" />
          Crear grupo
        </Button>
      </form>
    </div>
  );
}
