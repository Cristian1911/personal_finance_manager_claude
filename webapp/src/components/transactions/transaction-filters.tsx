"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Search, SlidersHorizontal, X } from "lucide-react";
import type { Account } from "@/types/domain";

export function TransactionFilters({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set("page", "1");
    router.push(`/transactions?${params.toString()}`);
  }

  function clearFilters() {
    router.push("/transactions");
  }

  const activeMonth = searchParams.get("month");
  const showExcluded = searchParams.get("showExcluded") === "true";
  const hasFilters =
    searchParams.get("search") ||
    searchParams.get("accountId") ||
    searchParams.get("direction") ||
    searchParams.get("dateFrom") ||
    searchParams.get("dateTo") ||
    searchParams.get("amountMin") ||
    searchParams.get("amountMax") ||
    showExcluded ||
    activeMonth;

  const activeFilterCount = [
    searchParams.get("search"),
    searchParams.get("accountId"),
    searchParams.get("direction"),
    searchParams.get("dateFrom"),
    searchParams.get("dateTo"),
    searchParams.get("amountMin"),
    searchParams.get("amountMax"),
    showExcluded ? "true" : null,
  ].filter(Boolean).length;

  // Shared filter controls — `mobile` makes all inputs full-width
  function renderFilters(mobile: boolean) {
    const inputWidth = mobile ? "w-full" : "w-full sm:w-[180px]";
    const directionWidth = mobile ? "w-full" : "w-full sm:w-[140px]";
    const dateWidth = mobile ? "w-full" : "w-full sm:w-[160px]";
    const amountWidth = mobile ? "w-full" : "w-full sm:w-[130px]";

    return (
      <>
        <div className={mobile ? "space-y-4" : "space-y-3"}>
          <div className={mobile ? "space-y-3" : "flex flex-wrap items-center gap-3"}>
            <div className={mobile ? "relative w-full" : "relative flex-1 min-w-[200px]"}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar transacciones..."
                defaultValue={searchParams.get("search") ?? ""}
                onChange={(e) => {
                  const timeout = setTimeout(
                    () => updateFilter("search", e.target.value),
                    300
                  );
                  return () => clearTimeout(timeout);
                }}
                className="pl-9"
              />
            </div>

            <Select
              defaultValue={searchParams.get("accountId") ?? "all"}
              onValueChange={(v) => updateFilter("accountId", v)}
            >
              <SelectTrigger className={inputWidth}>
                <SelectValue placeholder="Todas las cuentas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las cuentas</SelectItem>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              defaultValue={searchParams.get("direction") ?? "all"}
              onValueChange={(v) => updateFilter("direction", v)}
            >
              <SelectTrigger className={directionWidth}>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="OUTFLOW">Gastos</SelectItem>
                <SelectItem value="INFLOW">Ingresos</SelectItem>
              </SelectContent>
            </Select>

            {!activeMonth && (
              <>
                <Input
                  type="date"
                  defaultValue={searchParams.get("dateFrom") ?? ""}
                  onChange={(e) => updateFilter("dateFrom", e.target.value)}
                  className={dateWidth}
                />
                <Input
                  type="date"
                  defaultValue={searchParams.get("dateTo") ?? ""}
                  onChange={(e) => updateFilter("dateTo", e.target.value)}
                  className={dateWidth}
                />
              </>
            )}

            {!mobile && hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Limpiar
              </Button>
            )}
          </div>

          <div className={mobile ? "space-y-3" : "flex flex-wrap items-center gap-3"}>
            <CurrencyInput
              placeholder="Monto mín"
              defaultValue={searchParams.get("amountMin") ?? ""}
              onChange={(e) => {
                const timeout = setTimeout(
                  () => updateFilter("amountMin", e.target.value),
                  500
                );
                return () => clearTimeout(timeout);
              }}
              className={amountWidth}
            />
            <CurrencyInput
              placeholder="Monto máx"
              defaultValue={searchParams.get("amountMax") ?? ""}
              onChange={(e) => {
                const timeout = setTimeout(
                  () => updateFilter("amountMax", e.target.value),
                  500
                );
                return () => clearTimeout(timeout);
              }}
              className={amountWidth}
            />

            <div className={mobile ? "flex items-center gap-2" : "flex items-center gap-2 ml-auto"}>
              <Switch
                id={mobile ? "show-excluded-mobile" : "show-excluded"}
                checked={showExcluded}
                onCheckedChange={(checked) =>
                  updateFilter("showExcluded", checked ? "true" : "")
                }
              />
              <Label
                htmlFor={mobile ? "show-excluded-mobile" : "show-excluded"}
                className="text-sm text-muted-foreground cursor-pointer"
              >
                Mostrar excluidas
              </Label>
            </div>
          </div>

          {mobile && hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full">
              <X className="h-4 w-4 mr-1" />
              Limpiar filtros
            </Button>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      {/* Mobile: Filtros button + bottom sheet */}
      <div className="sm:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <SlidersHorizontal className="size-4 mr-2" />
              Filtros
              {activeFilterCount > 0 && (
                <span className="ml-1.5 size-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filtros</SheetTitle>
            </SheetHeader>
            <div className="py-4 px-4">
              {renderFilters(true)}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: inline filter rows */}
      <div className="hidden sm:block">
        {renderFilters(false)}
      </div>
    </>
  );
}
