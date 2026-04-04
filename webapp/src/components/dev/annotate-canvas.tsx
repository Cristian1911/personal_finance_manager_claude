"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Save } from "lucide-react";

// Minimal imperative API surface we use — Excalidraw doesn't re-export
// ExcalidrawImperativeAPI from its main index, so we define what we need.
interface ExcalidrawImperativeAPI {
  getSceneElements: () => unknown[];
  getAppState: () => Record<string, unknown>;
  getFiles: () => Record<string, unknown>;
  addFiles: (files: unknown[]) => void;
  updateScene: (scene: Record<string, unknown>) => void;
  scrollToContent: (...args: unknown[]) => void;
}

interface AnnotateCanvasProps {
  screenshotDataUrl: string | null;
  componentHint?: string;
  onSave: (data: {
    excalidrawJson: string;
    pngBlob: Blob;
    componentHint: string | null;
  }) => void;
  onClose: () => void;
}

export function AnnotateCanvas({
  screenshotDataUrl,
  componentHint,
  onSave,
  onClose,
}: AnnotateCanvasProps) {
  const excalidrawRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [Excalidraw, setExcalidraw] = useState<React.ComponentType<Record<string, unknown>> | null>(null);
  const [exportToBlob, setExportToBlob] = useState<((...args: unknown[]) => Promise<Blob>) | null>(null);

  // Dynamically import Excalidraw (heavy, dev-only)
  useEffect(() => {
    let cancelled = false;
    import("@excalidraw/excalidraw").then((mod) => {
      if (cancelled) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setExcalidraw(() => (mod as any).Excalidraw);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setExportToBlob(() => (mod as any).exportToBlob);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleExcalidrawMount = useCallback(
    (api: ExcalidrawImperativeAPI) => {
      excalidrawRef.current = api;
      if (screenshotDataUrl) {
        const img = new Image();
        img.onload = () => {
          const files = [
            {
              id: "screenshot-bg",
              dataURL: screenshotDataUrl,
              mimeType: "image/png",
              created: Date.now(),
              lastRetrieved: Date.now(),
            },
          ];
          const elements = [
            {
              type: "image",
              id: "screenshot-bg-element",
              fileId: "screenshot-bg",
              x: 0,
              y: 0,
              width: img.width,
              height: img.height,
              locked: true,
              isDeleted: false,
              version: 1,
              versionNonce: 0,
              roughness: 0,
              opacity: 100,
              angle: 0,
              strokeColor: "#000000",
              backgroundColor: "transparent",
              fillStyle: "solid",
              strokeWidth: 1,
              strokeStyle: "solid",
              seed: 1,
              groupIds: [],
              frameId: null,
              roundness: null,
              boundElements: null,
              updated: Date.now(),
              link: null,
              scale: [1, 1],
            },
          ];
          api.addFiles(files);
          api.updateScene({ elements });
          api.scrollToContent(undefined, { fitToViewport: true });
        };
        img.src = screenshotDataUrl;
      }
    },
    [screenshotDataUrl]
  );

  async function handleSave() {
    const api = excalidrawRef.current;
    if (!api || !exportToBlob) return;

    const elements = api.getSceneElements();
    const appState = api.getAppState();
    const files = api.getFiles();

    const excalidrawJson = JSON.stringify({
      type: "excalidraw",
      version: 2,
      elements,
      appState: { viewBackgroundColor: appState.viewBackgroundColor },
      files,
    });

    const pngBlob = await exportToBlob({
      elements,
      appState: { ...appState, exportWithDarkMode: true },
      files,
      mimeType: "image/png",
    });

    onSave({
      excalidrawJson,
      pngBlob,
      componentHint: componentHint ?? null,
    });
  }

  if (!Excalidraw) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80">
        <p className="text-z-sage-light text-sm">Cargando editor...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-white/6 bg-z-surface px-4 py-2">
        <span className="text-sm font-medium text-z-sage-light">
          {screenshotDataUrl ? "Anotar captura" : "Lienzo libre"}
          {componentHint && (
            <span className="ml-2 text-z-brass">· {componentHint}</span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 rounded-lg bg-z-brass px-3 py-1.5 text-xs font-semibold text-z-ink"
          >
            <Save className="size-3.5" />
            Guardar
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg border border-white/6 bg-z-surface-3 px-3 py-1.5 text-xs text-z-sage-light"
          >
            <X className="size-3.5" />
            Cerrar
          </button>
        </div>
      </div>
      {/* Excalidraw canvas */}
      <div className="flex-1">
        <Excalidraw
          excalidrawAPI={handleExcalidrawMount as never}
          theme="dark"
          langCode="es-ES"
          UIOptions={{
            canvasActions: {
              saveToActiveFile: false,
              loadScene: false,
              export: false,
            },
          }}
        />
      </div>
    </div>
  );
}
