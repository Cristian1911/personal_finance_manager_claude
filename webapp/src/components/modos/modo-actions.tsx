"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MoreHorizontal, Pencil, Trash2, ExternalLink, Plane } from "lucide-react";
import { toast } from "sonner";
import { deleteModo, setActiveModo } from "@/actions/modos";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { DESTRUCTIVE_GHOST_BUTTON_CLASS, ICON_TRIGGER_CLASS } from "@/lib/constants/styles";
import type { Modo } from "@/types/domain";

/**
 * Editar · Eliminar · Ver en Movimientos · Viaje activo — one menu shared by
 * the mobile header action slot and the desktop header.
 */
export function ModoActions({ modo, applyHref }: { modo: Modo; applyHref: string }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState(modo.is_active);

  function toggleActive(next: boolean) {
    setActive(next);
    startTransition(async () => {
      const res = await setActiveModo(next ? modo.id : null);
      if (!res.success) {
        setActive(!next);
        toast.error(res.error);
        return;
      }
      toast.success(next ? "Viaje activo: lo que registres a mano se etiqueta solo" : "Viaje terminado");
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteModo(modo.id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Viaje eliminado. Los movimientos y sus etiquetas se conservan.");
      router.push("/modos");
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <label className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex">
          <Plane className={cn("size-3.5", active ? "text-z-brass" : "text-z-sage-dark")} />
          Viaje activo
          <Switch checked={active} onCheckedChange={toggleActive} disabled={pending} aria-label="Viaje activo" />
        </label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Más acciones" className={cn(ICON_TRIGGER_CLASS, "p-2")}>
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              className="lg:hidden"
              onSelect={(e) => {
                e.preventDefault();
                toggleActive(!active);
              }}
            >
              <Plane className="size-4" />
              {active ? "Terminar viaje" : "Marcar como viaje activo"}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/modos/${modo.id}/edit`}>
                <Pencil className="size-4" />
                Editar viaje
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={applyHref}>
                <ExternalLink className="size-4" />
                Ver en Movimientos
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
              <Trash2 className="size-4" />
              Eliminar viaje
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar “{modo.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra el viaje y su configuración de reparto. Los movimientos, sus etiquetas y los
              pagos compartidos ya creados se conservan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="ghost"
              className={cn(DESTRUCTIVE_GHOST_BUTTON_CLASS)}
              disabled={pending}
              onClick={remove}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
