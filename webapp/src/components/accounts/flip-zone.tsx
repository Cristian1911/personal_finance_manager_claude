"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { CardFace } from "./card-face";
import { GraphFace } from "./graph-face";
import { RangePills, type RangeValue } from "./range-pills";
import type { Account } from "@/types/domain";
import type { SnapshotPoint } from "./account-detail-types";

interface FlipZoneProps {
  account: Account;
  snapshotData: SnapshotPoint[];
  trendPercent?: number;
}

export function FlipZone({ account, snapshotData, trendPercent }: FlipZoneProps) {
  const [flipped, setFlipped] = useState(false);
  const [range, setRange] = useState<RangeValue>(90);

  return (
    <div className="space-y-3">
      {/* Flip container */}
      <div
        className="cursor-pointer"
        style={{ perspective: "1000px" }}
        onClick={() => setFlipped((f) => !f)}
      >
        <div
          className="relative w-full transition-transform duration-400"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* Front: card */}
          <div style={{ backfaceVisibility: "hidden" }}>
            <CardFace account={account} />
          </div>

          {/* Back: graph */}
          <div
            className="absolute inset-0"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <GraphFace
              data={snapshotData}
              currencyCode={account.currency_code ?? "COP"}
              range={range}
              trendPercent={trendPercent}
            />
          </div>
        </div>
      </div>

      {/* Controls row: dots + range pills */}
      <div className="flex items-center justify-between px-1">
        {/* Dot indicators */}
        <div className="flex gap-1.5">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-colors",
              !flipped ? "bg-z-brass" : "bg-white/20"
            )}
          />
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-colors",
              flipped ? "bg-z-brass" : "bg-white/20"
            )}
          />
        </div>

        {/* Range pills — visible only when graph showing */}
        <div
          className={cn(
            "transition-all duration-300",
            flipped
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-1 pointer-events-none"
          )}
        >
          <RangePills
            value={range}
            onChange={setRange}
          />
        </div>
      </div>
    </div>
  );
}
