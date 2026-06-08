// webapp/src/components/dev/inspect-overlay.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface InspectInfo {
  componentName: string;
  filePath: string;
  rect: DOMRect;
}

type InspectAction = "annotate" | "storybook" | "copy";

interface InspectOverlayProps {
  onSelectComponent: (info: InspectInfo, action: InspectAction) => void;
  onClose: () => void;
}

/**
 * Walk up the React fiber tree from a DOM element to find the nearest
 * user-defined component (skips Host and built-in components).
 */
function getReactFiberFromElement(element: HTMLElement) {
  const key = Object.keys(element).find(
    (k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$")
  );
  if (!key) return null;
  return (element as unknown as Record<string, unknown>)[key] as Record<string, unknown> | null;
}

function findUserComponent(fiber: Record<string, unknown> | null): {
  name: string;
  source: string;
} | null {
  let current = fiber;
  while (current) {
    const type = current.type as Record<string, unknown> | ((...args: unknown[]) => unknown) | null;
    if (typeof type === "function") {
      const name = (type as { displayName?: string }).displayName
        || (type as { name?: string }).name
        || "Anonymous";
      if (!name.startsWith("_") && name !== "Anonymous" && name.length > 1) {
        const debugSource = current._debugSource as { fileName?: string; lineNumber?: number } | null;
        const source = debugSource?.fileName
          ? `${debugSource.fileName.replace(/^.*\/src\//, "src/")}:${debugSource.lineNumber}`
          : "";
        return { name, source };
      }
    }
    current = current.return as Record<string, unknown> | null;
  }
  return null;
}

export function InspectOverlay({ onSelectComponent, onClose }: InspectOverlayProps) {
  const [hovered, setHovered] = useState<InspectInfo | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (!target || overlayRef.current?.contains(target)) {
        setHovered(null);
        return;
      }

      const fiber = getReactFiberFromElement(target);
      const component = findUserComponent(fiber);
      if (!component) {
        setHovered(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      setHovered({
        componentName: component.name,
        filePath: component.source,
        rect,
      });
    });
  }, []);

  const [contextMenu, setContextMenu] = useState<{ info: InspectInfo; x: number; y: number } | null>(null);

  const handleClick = useCallback((e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hovered) {
      setContextMenu({ info: hovered, x: e.clientX, y: e.clientY });
    }
  }, [hovered]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("pointermove", handlePointerMove, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointermove", handlePointerMove, true);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handlePointerMove, handleClick, handleKeyDown]);

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[var(--z-layer-dev)] cursor-crosshair">
      {/* Instruction bar */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[calc(var(--z-layer-dev)+1)] flex items-center gap-2 rounded-full bg-z-surface-3 border border-white/6 px-4 py-2 text-xs text-z-sage-light shadow-lg">
        <span>Inspeccionar — toca un componente</span>
        <kbd className="hidden text-z-brass lg:inline">Esc</kbd>
        <button
          className="ml-1 flex size-6 items-center justify-center rounded-full bg-white/10 text-z-sage-light lg:hidden"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      {/* Highlight box */}
      {hovered && (
        <>
          <div
            className="pointer-events-none fixed border-2 border-dashed border-z-brass rounded-lg transition-all duration-75"
            style={{
              top: hovered.rect.top - 2,
              left: hovered.rect.left - 2,
              width: hovered.rect.width + 4,
              height: hovered.rect.height + 4,
            }}
          />
          {/* Label */}
          <div
            className="pointer-events-none fixed z-[calc(var(--z-layer-dev)+1)] rounded-md bg-z-brass px-2 py-1 text-[11px] font-semibold text-z-ink shadow-lg"
            style={{
              top: Math.max(0, hovered.rect.top - 28),
              left: hovered.rect.left,
            }}
          >
            {hovered.componentName}
            {hovered.filePath && (
              <span className="ml-1.5 font-normal opacity-70">
                {hovered.filePath}
              </span>
            )}
          </div>
        </>
      )}

      {/* Context menu on click */}
      {contextMenu && (
        <div
          className="fixed z-[calc(var(--z-layer-dev)+2)] rounded-xl border border-white/6 bg-z-surface-2 p-1.5 shadow-xl"
          style={{
            top: Math.max(8, Math.min(contextMenu.y, window.innerHeight - 220)),
            left: Math.max(8, Math.min(contextMenu.x, window.innerWidth - 220)),
          }}
        >
          <p className="px-3 py-1.5 text-xs font-semibold text-z-brass lg:px-2 lg:py-1 lg:text-[11px]">{contextMenu.info.componentName}</p>
          {([
            { id: "annotate" as const, label: "Anotar componente", emoji: "✏️", needsSource: false },
            { id: "storybook" as const, label: "Abrir en Storybook", emoji: "🧩", needsSource: true },
            { id: "copy" as const, label: "Copiar ruta", emoji: "📋", needsSource: true },
          ]).filter((action) => !action.needsSource || contextMenu.info.filePath).map((action) => (
            <button
              key={action.id}
              onClick={() => {
                if (action.id === "copy") {
                  navigator.clipboard.writeText(contextMenu.info.filePath);
                  setContextMenu(null);
                } else if (action.id === "storybook") {
                  const kebab = contextMenu.info.componentName.replace(/([A-Z])/g, "-$1").toLowerCase().replace(/^-/, "");
                  window.open(`http://localhost:6006/?path=/story/ui-${kebab}`, "_blank");
                  setContextMenu(null);
                } else {
                  onSelectComponent(contextMenu.info, action.id);
                  setContextMenu(null);
                }
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-z-sage-light hover:bg-white/5 lg:px-2 lg:py-1.5 lg:text-xs"
            >
              <span>{action.emoji}</span> {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
