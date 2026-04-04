"use client";

import { useState } from "react";
import { DevFAB } from "./dev-fab";

type DevAction = "inspect" | "annotate" | "sketch" | null;

export function DevOverlay() {
  const [activeAction, setActiveAction] = useState<DevAction>(null);

  return (
    <>
      <DevFAB onAction={setActiveAction} activeAction={activeAction} />
      {/* Inspect, Annotate, Sketch layers will be added in later tasks */}
      {activeAction === "inspect" && (
        <div className="fixed inset-0 z-[9998] pointer-events-none">
          {/* Placeholder — Task 4 fills this */}
        </div>
      )}
    </>
  );
}
