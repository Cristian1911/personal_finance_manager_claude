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
  const [selectedComponent, setSelectedComponent] = useState<InspectInfo | null>(null);

  function handleSelectComponent(info: InspectInfo) {
    setSelectedComponent(info);
    setActiveAction(null);
    // Context menu handles "storybook" and "copy" inline.
    // "annotate" comes here — Task 5 wires it to open the canvas.
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
