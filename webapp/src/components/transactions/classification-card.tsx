"use client";

import { ChevronRight, Plus, UserRound, X } from "lucide-react";
import { CategoryIcon } from "@/components/categories/category-icon";
import { cn } from "@/lib/utils";
import { chipBackground, zoneTextColor } from "@/lib/utils/zone-colors";
import type { LeafCategory } from "@/lib/utils/categories";

/**
 * "Clasificación" list — the shared row stack used by the transaction detail
 * page and the mobile create form so both surfaces read identically: a
 * rounded card, one tappable row per attribute (Cuenta · Categoría ·
 * Destinatario · Etiquetas), value on the right with a chevron.
 */

/** Fallback category chip color when a category has no `color` set. Hex literal
 * is intentional — `chipBackground()` / `zoneTextColor()` in `zone-colors.ts`
 * process raw hex, not CSS variables. Matches --z-sage (#768053). */
export const FALLBACK_CATEGORY_COLOR = "#768053";

export function ClassificationCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-white/6 bg-z-surface-2/60",
        // Every row after the first draws its own top hairline.
        "[&>*+*]:border-t [&>*+*]:border-white/6",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface ClassificationRowProps {
  label: string;
  onClick: () => void;
  /** Right-hand value — a chip, a name, or a brass "Asignar" prompt. */
  children: React.ReactNode;
  disabled?: boolean;
}

export function ClassificationRow({
  label,
  onClick,
  children,
  disabled,
}: ClassificationRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors hover:bg-white/[0.03] disabled:opacity-50"
    >
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5">
        {children}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
      </span>
    </button>
  );
}

/** Brass call-to-action shown when a row has no value yet ("Categorizar"). */
export function ClassificationPrompt({
  children,
  muted,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <span className={cn("text-sm", muted ? "text-muted-foreground" : "text-z-brass")}>
      {children}
    </span>
  );
}

export function ClassificationAccountValue({
  name,
  color,
}: {
  name: string | null | undefined;
  color: string | null | undefined;
}) {
  return (
    <>
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: color ?? undefined }}
      />
      <span className="truncate text-sm font-medium">{name ?? "Sin cuenta"}</span>
    </>
  );
}

export function ClassificationCategoryValue({ category }: { category: LeafCategory }) {
  const color = category.color ?? FALLBACK_CATEGORY_COLOR;
  return (
    <span
      className="inline-flex min-w-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: chipBackground(color), color: zoneTextColor(color) }}
    >
      {category.icon && <CategoryIcon icon={category.icon} className="size-3.5 shrink-0" />}
      <span className="truncate">{category.name}</span>
    </span>
  );
}

export function ClassificationDestinatarioValue({ name }: { name: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-z-brass/12 px-2 py-0.5 text-xs font-semibold text-z-brass">
      <UserRound className="size-3.5 shrink-0" />
      <span className="truncate">{name}</span>
    </span>
  );
}

interface ClassificationTagsRowProps {
  tags: Array<{ id: string; name: string }>;
  onAdd: () => void;
  onRemove: (tagId: string) => void;
  label?: string;
}

/** Etiquetas row: "+ Agregar/Editar" on the right, removable chips below. */
export function ClassificationTagsRow({
  tags,
  onAdd,
  onRemove,
  label = "Etiquetas",
}: ClassificationTagsRowProps) {
  return (
    <div className="px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 text-sm text-z-brass"
        >
          <Plus className="size-3.5" />
          {tags.length > 0 ? "Editar" : "Agregar"}
        </button>
      </div>
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 rounded-full border border-z-brass/20 bg-z-brass/10 py-0.5 pl-2.5 pr-1 text-[11px] font-medium text-z-brass"
            >
              <span className="truncate">{t.name}</span>
              <button
                type="button"
                aria-label={`Quitar etiqueta ${t.name}`}
                onClick={() => onRemove(t.id)}
                className="ml-0.5 inline-flex size-4 items-center justify-center rounded-full text-z-brass/60 transition-colors hover:bg-z-brass/15 hover:text-z-brass"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
