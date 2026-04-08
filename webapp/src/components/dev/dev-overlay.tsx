"use client";

import { useCallback, useState } from "react";
import { DevFAB } from "./dev-fab";
import { InspectOverlay } from "./inspect-overlay";
import { AnnotateCanvas } from "./annotate-canvas";
import { ReviewSaveDialog } from "./review-save-dialog";

type DevAction = "inspect" | "annotate" | "sketch" | null;

interface InspectInfo {
  componentName: string;
  filePath: string;
  rect: DOMRect;
}

export function DevOverlay() {
  const [activeAction, setActiveAction] = useState<DevAction>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [componentHint, setComponentHint] = useState<string | undefined>();
  const [pendingSave, setPendingSave] = useState<{
    excalidrawJson: string;
    pngBlob: Blob;
    componentHint: string | null;
  } | null>(null);

  const captureScreenshot = useCallback(async () => {
    const { default: html2canvas } = await import("html2canvas");
    const overlay = document.getElementById("dev-overlay-root");
    if (overlay) overlay.style.display = "none";

    const canvas = await html2canvas(document.body, {
      useCORS: true,
      scale: window.devicePixelRatio,
      backgroundColor: null,
    });

    if (overlay) overlay.style.display = "";
    return canvas.toDataURL("image/png");
  }, []);

  async function handleAction(action: DevAction) {
    if (action === "annotate") {
      const dataUrl = await captureScreenshot();
      setScreenshot(dataUrl);
      setComponentHint(undefined);
    } else if (action === "sketch") {
      setScreenshot(null);
      setComponentHint(undefined);
    }
    setActiveAction(action);
  }

  async function handleSelectComponent(info: InspectInfo, action: "annotate" | "storybook" | "copy") {
    if (action === "copy") {
      await navigator.clipboard.writeText(info.filePath);
      setActiveAction(null);
      return;
    }
    if (action === "storybook") {
      const kebab = info.componentName.replace(/([A-Z])/g, "-$1").toLowerCase().replace(/^-/, "");
      window.open(`http://localhost:6006/?path=/story/ui-${kebab}`, "_blank");
      setActiveAction(null);
      return;
    }
    // action === "annotate"
    const dataUrl = await captureScreenshot();
    setScreenshot(dataUrl);
    setComponentHint(info.componentName);
    setActiveAction("annotate");
  }

  function handleAnnotationSave(data: {
    excalidrawJson: string;
    pngBlob: Blob;
    componentHint: string | null;
  }) {
    setPendingSave(data);
  }

  const showCanvas = activeAction === "annotate" || activeAction === "sketch";

  return (
    <div id="dev-overlay-root">
      <DevFAB onAction={handleAction} activeAction={activeAction} />

      {activeAction === "inspect" && (
        <InspectOverlay
          onSelectComponent={handleSelectComponent}
          onClose={() => setActiveAction(null)}
        />
      )}

      {showCanvas && (
        <AnnotateCanvas
          screenshotDataUrl={screenshot}
          componentHint={componentHint}
          onSave={handleAnnotationSave}
          onClose={() => {
            setActiveAction(null);
            setScreenshot(null);
          }}
        />
      )}
      {pendingSave && (
        <ReviewSaveDialog
          excalidrawJson={pendingSave.excalidrawJson}
          pngBlob={pendingSave.pngBlob}
          componentHint={pendingSave.componentHint}
          onSaved={() => {
            setPendingSave(null);
            setActiveAction(null);
            setScreenshot(null);
          }}
          onCancel={() => setPendingSave(null)}
        />
      )}
    </div>
  );
}
