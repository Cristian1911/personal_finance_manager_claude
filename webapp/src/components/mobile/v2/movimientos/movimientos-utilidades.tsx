"use client";

import { useState, Suspense } from "react";
import { cn } from "@/lib/utils";
import { formatMonthLabel } from "@/lib/utils/date";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { TransactionFilters } from "@/components/transactions/transaction-filters";
import { MonthSelector } from "@/components/month-selector";
import { MobileTransactionForm } from "@/components/mobile/mobile-transaction-form";
import type { Account, CategoryWithChildren, Tag } from "@/types/domain";

interface MovimientosUtilidadesProps {
  accounts: Account[];
  categories: CategoryWithChildren[];
  tags: Tag[];
}

const pillClass =
  "rounded-full border border-white/6 bg-black/10 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground";

export function MovimientosUtilidades({
  accounts,
  categories,
  tags,
}: MovimientosUtilidadesProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const monthLabel = formatMonthLabel(new Date());

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {/* Buscar */}
        <button
          type="button"
          className={cn(pillClass, searchOpen && "border-z-brass/30 text-z-brass")}
          onClick={() => setSearchOpen((prev) => !prev)}
        >
          Buscar
        </button>

        {/* Filtrar */}
        <Drawer>
          <DrawerTrigger asChild>
            <button type="button" className={pillClass}>
              Filtrar
            </button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[80dvh]">
            <DrawerHeader>
              <DrawerTitle>Filtros</DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-6 space-y-4">
              <Suspense>
                <TransactionFilters accounts={accounts} tags={tags} />
              </Suspense>
            </div>
          </DrawerContent>
        </Drawer>

        {/* Month selector */}
        <Drawer>
          <DrawerTrigger asChild>
            <button type="button" className={cn(pillClass, "capitalize")}>
              {monthLabel}
            </button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[80dvh]">
            <DrawerHeader>
              <DrawerTitle>Seleccionar mes</DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-6">
              <Suspense>
                <MonthSelector />
              </Suspense>
            </div>
          </DrawerContent>
        </Drawer>

        {/* Registrar */}
        <Drawer>
          <DrawerTrigger asChild>
            <button type="button" className={pillClass}>
              Registrar
            </button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[85dvh]">
            <DrawerHeader>
              <DrawerTitle>Registrar movimiento</DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-6">
              <MobileTransactionForm
                accounts={accounts}
                categories={categories}
              />
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
