"use client";

import * as React from "react";
import { Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  testDestinatarioPattern,
  type PatternTestResult,
} from "@/actions/destinatarios";
import { tokenizeDescription } from "@/lib/utils/tokenize-description";
import { formatCurrency } from "@/lib/utils/currency";
import { GHOST_BUTTON_CLASS, CHIP_NEUTRAL_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode } from "@/types/domain";

export interface DestinatarioPatternBuilderProps {
  rawDescription?: string | null;
  merchantName?: string | null;
  amount?: number | null;
  currencyCode?: CurrencyCode | null;
  /**
   * When set, the text input carries this `name` attribute so the value is
   * submitted by a native `<form action={...}>` (used by the create wizard).
   */
  inputName?: string;
  /** Notifies the current comma/space-joined pattern string on every change. */
  onValueChange?: (value: string) => void;
  /** Helper text rendered under the field. */
  helpText?: string;
}

/**
 * Shared pattern-builder used by the destinatario creation wizard and the
 * "add pattern" flow on a transaction. Tokenizes the originating transaction's
 * description into tappable chips, keeps an editable pattern field (comma →
 * multiple rules), and runs an on-demand "Probar" test against unassigned
 * transactions.
 */
export function DestinatarioPatternBuilder({
  rawDescription,
  merchantName,
  amount,
  currencyCode,
  inputName,
  onValueChange,
  helpText = "Toca las palabras de esta transacción para crear patrones de detección.",
}: DestinatarioPatternBuilderProps) {
  const chips = React.useMemo(() => {
    const base = tokenizeDescription(rawDescription);
    const extra: string[] = [];
    if (merchantName?.trim()) extra.push(merchantName.trim());
    return Array.from(new Set([...extra, ...base]));
  }, [rawDescription, merchantName]);

  const [selected, setSelected] = React.useState<string[]>(
    chips[0] ? [chips[0]] : [],
  );
  const [patterns, setPatterns] = React.useState(chips[0] ?? "");
  const [testResult, setTestResult] = React.useState<PatternTestResult | null>(
    null,
  );
  const [isTesting, startTest] = React.useTransition();

  // Notify the parent of the current value without retriggering on a fresh
  // inline callback each render.
  const onValueChangeRef = React.useRef(onValueChange);
  React.useEffect(() => {
    onValueChangeRef.current = onValueChange;
  });
  React.useEffect(() => {
    onValueChangeRef.current?.(patterns);
  }, [patterns]);

  function toggleChip(token: string) {
    setTestResult(null);
    setSelected((prev) => {
      const next = prev.includes(token)
        ? prev.filter((t) => t !== token)
        : [...prev, token];
      setPatterns(next.join(" "));
      return next;
    });
  }

  function handleTest() {
    const list = patterns.split(",").map((p) => p.trim()).filter(Boolean);
    if (list.length === 0) return;
    startTest(async () => {
      const results = await Promise.all(
        list.map((p) => testDestinatarioPattern(p, "contains")),
      );
      const combined: PatternTestResult = { matchCount: 0, samples: [] };
      const seen = new Set<string>();
      for (const r of results) {
        if (!r.success) continue;
        combined.matchCount += r.data.matchCount;
        for (const s of r.data.samples) {
          if (!seen.has(s.id)) {
            seen.add(s.id);
            combined.samples.push(s);
          }
        }
      }
      combined.samples = combined.samples.slice(0, 5);
      setTestResult(combined);
    });
  }

  return (
    <div className="space-y-2">
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((token) => (
            <button
              key={token}
              type="button"
              aria-pressed={selected.includes(token)}
              onClick={() => toggleChip(token)}
              className={cn(
                CHIP_NEUTRAL_CLASS,
                "px-2.5 py-1 text-[11px] font-medium",
                selected.includes(token)
                  ? "border-z-brass/30 bg-z-brass/10 text-z-brass"
                  : "text-muted-foreground hover:bg-white/[0.06]",
              )}
            >
              {token}
            </button>
          ))}
          {amount != null && currencyCode && (
            <span className="rounded-full border border-white/6 bg-white/[0.02] px-2.5 py-1 text-[11px] text-muted-foreground/70">
              {formatCurrency(amount, currencyCode)}
            </span>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          name={inputName}
          value={patterns}
          className="flex-1"
          onChange={(e) => {
            setPatterns(e.target.value);
            setTestResult(null);
          }}
          placeholder="Toca chips o escribe; separa con comas para varias reglas"
        />
        <Button
          type="button"
          size="icon"
          className={GHOST_BUTTON_CLASS}
          onClick={handleTest}
          disabled={!patterns.trim() || isTesting}
          aria-label="Probar patrón"
          title="Probar patrón"
        >
          {isTesting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{helpText}</p>
      {testResult && (
        <div className="space-y-2 rounded-xl border border-white/6 bg-z-surface-2 p-3">
          <p className="text-xs font-medium">
            {testResult.matchCount === 0
              ? "Sin coincidencias en transacciones sin asignar"
              : `${testResult.matchCount} transacción${testResult.matchCount === 1 ? "" : "es"} coinciden`}
          </p>
          {testResult.samples.length > 0 && (
            <ul className="space-y-1">
              {testResult.samples.map((s) => (
                <li
                  key={s.id}
                  className="flex min-w-0 justify-between gap-2 text-xs text-muted-foreground"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {s.rawDescription}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatCurrency(s.amount, s.currencyCode as CurrencyCode)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
