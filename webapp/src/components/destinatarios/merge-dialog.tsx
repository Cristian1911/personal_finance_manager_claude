"use client";

import { useState } from "react";
import { Merge } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { mergeDestinatarios } from "@/actions/destinatarios";

interface MergeDialogProps {
  /** Selected destinatarios to merge */
  selected: { id: string; name: string }[];
  /** Callback after successful merge */
  onMerged?: () => void;
}

export function MergeDialog({ selected, onMerged }: MergeDialogProps) {
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState<string>(selected[0]?.id ?? "");
  const [merging, setMerging] = useState(false);

  if (selected.length < 2) return null;

  async function handleMerge() {
    if (!targetId) {
      toast.error("Selecciona el destinatario destino");
      return;
    }

    const sourceIds = selected
      .filter((d) => d.id !== targetId)
      .map((d) => d.id);

    setMerging(true);
    const result = await mergeDestinatarios(targetId, sourceIds);
    setMerging(false);

    if (result.success) {
      setOpen(false);
      toast.success("Destinatarios fusionados");
      onMerged?.();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Merge className="size-4 mr-2" />
          Fusionar ({selected.length})
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fusionar destinatarios</DialogTitle>
          <DialogDescription>
            Las transacciones y reglas de los destinatarios seleccionados se
            moverán al destinatario destino. Los demás se eliminarán.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Label>Selecciona el destinatario destino</Label>
          <div className="space-y-2">
            {selected.map((d) => (
              <label
                key={d.id}
                className={`flex items-center gap-3 rounded-md border p-3 cursor-pointer transition-colors ${
                  targetId === d.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name="merge-target"
                  value={d.id}
                  checked={targetId === d.id}
                  onChange={() => setTargetId(d.id)}
                  className="accent-primary"
                />
                <span className="font-medium">{d.name}</span>
                {targetId === d.id && (
                  <span className="ml-auto text-xs text-primary">Destino</span>
                )}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {selected.length - 1} destinatario
            {selected.length - 1 !== 1 ? "s" : ""} será
            {selected.length - 1 !== 1 ? "n" : ""} fusionado
            {selected.length - 1 !== 1 ? "s" : ""} en &quot;
            {selected.find((d) => d.id === targetId)?.name ?? ""}&quot;
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleMerge} disabled={merging || !targetId}>
            {merging ? "Fusionando..." : "Fusionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
