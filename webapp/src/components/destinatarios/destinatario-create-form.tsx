"use client";

import * as React from "react";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
import { DestinatarioPatternBuilder } from "@/components/destinatarios/destinatario-pattern-builder";
import {
  createDestinatario,
  type CreateDestinatarioResult,
} from "@/actions/destinatarios";
import { tokenizeDescription } from "@/lib/utils/tokenize-description";
import { useMediaQuery } from "@/hooks/use-media-query";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import type { ActionResult } from "@/types/actions";
import type { CategoryWithChildren, CurrencyCode } from "@/types/domain";

export interface DestinatarioCreateSeed {
  rawDescription?: string | null;
  merchantName?: string | null;
  amount?: number | null;
  currencyCode?: CurrencyCode | null;
}

export interface DestinatarioCreateFormProps extends DestinatarioCreateSeed {
  categories: CategoryWithChildren[];
  /** Called with the created destinatario; caller handles assignment + close. */
  onCreated: (dest: {
    id: string;
    name: string;
    defaultCategoryId: string | null;
  }) => void;
  onCancel: () => void;
}

export function DestinatarioCreateForm({
  rawDescription,
  merchantName,
  amount,
  currencyCode,
  categories,
  onCreated,
  onCancel,
}: DestinatarioCreateFormProps) {
  const nameDefault = React.useMemo(() => {
    if (merchantName?.trim()) return merchantName.trim();
    return tokenizeDescription(rawDescription)[0] ?? "";
  }, [merchantName, rawDescription]);

  const [categoryId, setCategoryId] = React.useState<string | null>(null);
  const [state, formAction, pending] = React.useActionState<
    ActionResult<CreateDestinatarioResult>,
    FormData
  >(createDestinatario, { success: false, error: "" });

  // Keep the latest onCreated without retriggering the success effect when the
  // parent passes a fresh inline callback each render.
  const onCreatedRef = React.useRef(onCreated);
  React.useEffect(() => {
    onCreatedRef.current = onCreated;
  });

  React.useEffect(() => {
    if (state.success) {
      onCreatedRef.current({
        id: state.data.id,
        name: state.data.name,
        defaultCategoryId: state.data.default_category_id ?? null,
      });
    }
  }, [state]);

  return (
    <form action={formAction} className="w-full min-w-0 space-y-4">
      {!state.success && state.error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="dcf-name">Nombre</Label>
        <Input
          id="dcf-name"
          name="name"
          defaultValue={nameDefault}
          placeholder="Ej: Nequi, Spotify"
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Categoría por defecto</Label>
        <CategoryZonePicker
          categories={categories}
          value={categoryId}
          onValueChange={setCategoryId}
          variant="popover"
          name="default_category_id"
          placeholder="Sin categoría"
          triggerClassName="w-full"
        />
      </div>

      <div className="space-y-2">
        <Label>Patrones de detección</Label>
        <DestinatarioPatternBuilder
          inputName="patterns"
          rawDescription={rawDescription}
          merchantName={merchantName}
          amount={amount}
          currencyCode={currencyCode}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="dcf-notes">Notas (opcional)</Label>
        <textarea
          id="dcf-notes"
          name="notes"
          rows={2}
          placeholder="Cualquier detalle útil sobre este destinatario…"
          className="w-full rounded-lg border border-white/6 bg-white/[0.03] px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-z-brass/40"
        />
      </div>

      <input type="hidden" name="is_active" value="true" />

      <div className="flex justify-end gap-2">
        <Button type="button" className={GHOST_BUTTON_CLASS} onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" className={BRASS_BUTTON_CLASS} disabled={pending}>
          {pending ? "Creando…" : "Crear y asignar"}
        </Button>
      </div>
    </form>
  );
}

// ─── Responsive dialog wrapper ───────────────────────────────────────────────

export interface DestinatarioCreateDialogProps extends DestinatarioCreateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Wraps DestinatarioCreateForm in a centered Dialog on desktop and a
 * full-screen Dialog on mobile (not a bottom sheet) — the full-screen surface
 * avoids the keyboard/drag jank a vaul Drawer had and gives the nested
 * CategoryZonePicker room to render fully.
 */
export function DestinatarioCreateDialog({
  open,
  onOpenChange,
  ...formProps
}: DestinatarioCreateDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const title = "Crear destinatario";
  const description = "Crea un destinatario a partir de esta transacción.";

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserRound className="size-4 text-z-brass" />
              {title}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DestinatarioCreateForm {...formProps} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "left-0 top-0 flex h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0",
          "flex-col gap-0 rounded-none border-0 p-0",
        )}
      >
        <DialogHeader
          className="shrink-0 border-b border-white/6 px-4 pb-3 text-left"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="size-4 text-z-brass" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <DestinatarioCreateForm {...formProps} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
