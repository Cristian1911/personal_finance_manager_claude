"use client";

import { useRouter, useSearchParams } from "next/navigation";
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
import { Search, X } from "lucide-react";
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
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
          <SelectTrigger className="w-[180px]">
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
          <SelectTrigger className="w-[140px]">
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
              className="w-[160px]"
            />
            <Input
              type="date"
              defaultValue={searchParams.get("dateTo") ?? ""}
              onChange={(e) => updateFilter("dateTo", e.target.value)}
              className="w-[160px]"
            />
          </>
        )}

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Limpiar
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="number"
          placeholder="Monto mín"
          defaultValue={searchParams.get("amountMin") ?? ""}
          onChange={(e) => {
            const timeout = setTimeout(
              () => updateFilter("amountMin", e.target.value),
              500
            );
            return () => clearTimeout(timeout);
          }}
          className="w-[130px]"
          min={0}
        />
        <Input
          type="number"
          placeholder="Monto máx"
          defaultValue={searchParams.get("amountMax") ?? ""}
          onChange={(e) => {
            const timeout = setTimeout(
              () => updateFilter("amountMax", e.target.value),
              500
            );
            return () => clearTimeout(timeout);
          }}
          className="w-[130px]"
          min={0}
        />

        <div className="flex items-center gap-2 ml-auto">
          <Switch
            id="show-excluded"
            checked={showExcluded}
            onCheckedChange={(checked) =>
              updateFilter("showExcluded", checked ? "true" : "")
            }
          />
          <Label htmlFor="show-excluded" className="text-sm text-muted-foreground cursor-pointer">
            Mostrar excluidas
          </Label>
        </div>
      </div>
    </div>
  );
}
