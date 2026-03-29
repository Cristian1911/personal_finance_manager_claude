"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCategory } from "@/actions/categories";
import { toast } from "sonner";
import type { TransactionDirection } from "@/types/domain";

interface InlineCategoryFormProps {
  parentId?: string | null;
  direction?: TransactionDirection | null;
  parentColor?: string;
  parentIcon?: string;
  onCreated?: (categoryId: string) => void;
  initialName?: string;
  placeholder?: string;
}

export function InlineCategoryForm({
  parentId,
  direction,
  parentColor,
  parentIcon,
  onCreated,
  initialName = "",
  placeholder = "Nombre de nueva categoría...",
}: InlineCategoryFormProps) {
  const [name, setName] = useState(initialName);
  const [isPending, startTransition] = useTransition();

  function generateSlug(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 50);
  }

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;

    const formData = new FormData();
    formData.append("name", trimmed);
    formData.append("name_es", trimmed);
    formData.append("slug", generateSlug(trimmed));
    formData.append("icon", parentIcon ?? "tag");
    formData.append("color", parentColor ?? "#6b7280");
    if (parentId) formData.append("parent_id", parentId);
    if (direction) formData.append("direction", direction);
    formData.append("is_essential", "false");

    startTransition(async () => {
      const result = await createCategory(
        { success: false, error: "" },
        formData
      );
      if (result.success) {
        setName("");
        toast.success(`Categoría "${trimmed}" creada`);
        onCreated?.(result.data.id);
      } else {
        toast.error(result.error ?? "Error al crear categoría");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        placeholder={placeholder}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          }
        }}
        className="h-8 text-sm"
        disabled={isPending}
      />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={handleSubmit}
        disabled={isPending || !name.trim()}
        className="shrink-0"
      >
        {isPending ? "..." : <Plus className="h-4 w-4" />}
      </Button>
    </div>
  );
}
