// webapp/src/components/dev/dev-overlay.tsx
"use client";

import { useState } from "react";
import { DevFAB } from "./dev-fab";
import { InspectOverlay } from "./inspect-overlay";

type DevAction = "inspect" | "annotate" | "sketch" | null;

interface InspectInfo {
  componentName: string;
  filePath: string;
  rect: DOMRect;
}

export function DevOverlay() {
  const [activeAction, setActiveAction] = useState<DevAction>(null);
  function handleSelectComponent(info: InspectInfo) {
    setActiveAction(null);
    // Task 5 wires this to open the annotation canvas
    console.log("[UI Pal] Selected for annotation:", info.componentName, info.filePath);
  }

  return (
    <>
      <DevFAB onAction={setActiveAction} activeAction={activeAction} />
      {activeAction === "inspect" && (
        <InspectOverlay
          onSelectComponent={handleSelectComponent}
          onClose={() => setActiveAction(null)}
        />
      )}
    </>
  );
}
