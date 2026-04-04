"use client";

import { useReviewMode } from "@/components/dev/use-review-mode";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function ReviewModeToggle() {
  if (process.env.NODE_ENV !== "development") return null;

  const { enabled, toggle } = useReviewMode();

  return (
    <div className="flex items-center justify-between">
      <div>
        <Label htmlFor="review-mode">Modo Revisión</Label>
        <p className="text-xs text-muted-foreground">
          Activa el botón flotante para inspeccionar y anotar componentes
        </p>
      </div>
      <Switch id="review-mode" checked={enabled} onCheckedChange={toggle} />
    </div>
  );
}
