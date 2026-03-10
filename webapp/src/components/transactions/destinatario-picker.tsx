"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X, Loader2 } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  assignDestinatario,
  removeDestinatarioFromTransaction,
} from "@/actions/categorize";

type DestinatarioOption = {
  id: string;
  name: string;
  is_active: boolean;
};

interface DestinatarioPickerProps {
  transactionId: string;
  currentDestinatarioId: string | null;
  destinatarios: DestinatarioOption[];
}

export function DestinatarioPicker({
  transactionId,
  currentDestinatarioId,
  destinatarios,
}: DestinatarioPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState(currentDestinatarioId);

  const activeDestinatarios = destinatarios.filter((d) => d.is_active);
  const selected = destinatarios.find((d) => d.id === selectedId);

  async function handleSelect(destinatarioId: string) {
    setOpen(false);
    setLoading(true);
    try {
      const result = await assignDestinatario(transactionId, destinatarioId);
      if (result.success) {
        setSelectedId(destinatarioId);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove() {
    setLoading(true);
    try {
      const result = await removeDestinatarioFromTransaction(transactionId);
      if (result.success) {
        setSelectedId(null);
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Actualizando...</span>
      </div>
    );
  }

  // If a destinatario is assigned, show it as a badge with remove button
  if (selected) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Link href={`/destinatarios/${selected.id}`}>
          <Badge
            variant="secondary"
            className="cursor-pointer hover:bg-secondary/80"
          >
            {selected.name}
          </Badge>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
          onClick={handleRemove}
        >
          <X className="h-3 w-3 mr-1" />
          Quitar
        </Button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            size="sm"
            className="justify-between font-normal text-muted-foreground"
          >
            Seleccionar destinatario...
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[240px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar destinatario..." />
            <CommandList>
              <CommandEmpty>Sin resultados.</CommandEmpty>
              <CommandGroup>
                {activeDestinatarios.map((d) => (
                  <CommandItem
                    key={d.id}
                    value={d.name}
                    onSelect={() => handleSelect(d.id)}
                  >
                    {d.name}
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        selectedId === d.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
    </Popover>
  );
}
