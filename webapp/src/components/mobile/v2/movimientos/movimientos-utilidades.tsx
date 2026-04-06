"use client";

import { useState, Suspense } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { TransactionFilters } from "@/components/transactions/transaction-filters";
import type { Account, Tag } from "@/types/domain";

interface MovimientosUtilidadesProps {
  accounts: Account[];
  tags: Tag[];
}

const pillClass =
  "flex items-center justify-center rounded-full border border-white/6 bg-black/10 text-muted-foreground transition-colors";

export function MovimientosUtilidades({
  accounts,
  tags,
}: MovimientosUtilidadesProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {/* Search icon pill */}
        <button
          type="button"
          className={cn(
            pillClass,
            "size-8",
            searchOpen && "border-z-brass/30 text-z-brass"
          )}
          onClick={() => setSearchOpen((prev) => !prev)}
          aria-label="Buscar"
        >
          <Search className="size-3.5" />
        </button>

        {/* Filter pill */}
        <Drawer>
          <DrawerTrigger asChild>
            <button
              type="button"
              className={cn(pillClass, "gap-1.5 px-3 py-1.5 text-[10px] font-semibold")}
            >
              <SlidersHorizontal className="size-3" />
              Filtrar
            </button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[80dvh]">
            <DrawerHeader>
              <DrawerTitle>Filtros</DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-6 space-y-4">
              <Suspense>
                <TransactionFilters accounts={accounts} tags={tags} embedded />
              </Suspense>
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      {/* Search input — inline toggle */}
      {searchOpen && (
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Buscar movimiento..."
          autoFocus
          className="w-full rounded-xl border border-white/6 bg-black/10 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-z-brass/30 focus:outline-none"
        />
      )}
    </div>
  );
}
