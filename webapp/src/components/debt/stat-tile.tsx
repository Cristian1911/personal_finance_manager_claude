"use client";

import { useState } from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Info } from "lucide-react";

interface StatTileProps {
  label: string;
  children: React.ReactNode;
  popoverContent?: React.ReactNode;
}

export function StatTile({ label, children, popoverContent }: StatTileProps) {
  const [open, setOpen] = useState(false);

  const tile = (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        {popoverContent && (
          <Info className="h-3 w-3 text-muted-foreground/50" />
        )}
      </div>
      {children}
    </div>
  );

  if (!popoverContent) {
    return (
      <div className="bg-[#0f0f11] border border-[#1f1f23] rounded-lg p-4">
        {tile}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="bg-[#0f0f11] border border-[#1f1f23] rounded-lg p-4 text-left w-full cursor-pointer hover:border-muted-foreground/30 transition-colors"
        >
          {tile}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="center" className="w-auto min-w-[200px] p-3">
        {popoverContent}
      </PopoverContent>
    </Popover>
  );
}
