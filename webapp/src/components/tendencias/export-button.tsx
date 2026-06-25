"use client";
import { Download } from "lucide-react";
import type { CategoryTrend } from "@zeta/shared";
import { GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";

// UTF-8 BOM so Excel detects the encoding. Built at runtime to keep the source
// pure-ASCII (no literal BOM byte, no fragile escape).
const BOM = String.fromCharCode(0xfeff);

/** Builds a category×month CSV in-memory and triggers a download. No library. */
export function ExportButton({ categories, months, range }: { categories: CategoryTrend[]; months: string[]; range: string }) {
  function exportCsv() {
    const header = ["Categoría", ...months, "Total"];
    const rows = categories.map((c) => [escapeCsv(c.nameEs), ...c.monthly.map(String), String(c.total)]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tendencias-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <button
      type="button"
      onClick={exportCsv}
      disabled={categories.length === 0}
      className={cn(
        GHOST_BUTTON_CLASS,
        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50",
      )}
    >
      <Download className="size-3.5" />
      Exportar CSV
    </button>
  );
}

function escapeCsv(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
