"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { GHOST_BUTTON_CLASS } from "@/lib/constants/styles";

const MIN_SCALE = 1;
const MAX_SCALE = 6;

interface View {
  scale: number;
  x: number;
  y: number;
}

interface ImageZoomPanProps {
  src: string;
  alt?: string;
  /** Sizing for the outer container (give it a height). */
  className?: string;
  imageClassName?: string;
}

/**
 * Self-contained image viewer with wheel/pinch zoom + drag pan, isolated to the
 * image container — gestures never scroll the surrounding page (touch-action:
 * none + preventDefault). No external gesture/animation library (the codebase
 * avoids deps); pointer events + a CSS transform only.
 */
export function ImageZoomPan({ src, alt = "", className, imageClassName }: ImageZoomPanProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchDist = useRef<number | null>(null);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });

  const clampView = useCallback((scale: number, x: number, y: number): View => {
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
    if (next <= MIN_SCALE + 0.001) return { scale: MIN_SCALE, x: 0, y: 0 };
    const rect = containerRef.current?.getBoundingClientRect();
    const w = rect?.width ?? 0;
    const h = rect?.height ?? 0;
    const minX = w * (1 - next);
    const minY = h * (1 - next);
    return {
      scale: next,
      x: Math.min(0, Math.max(minX, x)),
      y: Math.min(0, Math.max(minY, y)),
    };
  }, []);

  // Zoom toward a container-relative point (px, py), keeping that point fixed.
  const zoomAt = useCallback(
    (targetScale: number, px: number, py: number) => {
      setView((v) => {
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, targetScale));
        const k = next / v.scale;
        const x = px - (px - v.x) * k;
        const y = py - (py - v.y) * k;
        return clampView(next, x, y);
      });
    },
    [clampView],
  );

  // Wheel zoom — attached natively so preventDefault works (React wheel is passive).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      setView((v) => {
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
        const k = next / v.scale;
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const x = px - (px - v.x) * k;
        const y = py - (py - v.y) * k;
        return clampView(next, x, y);
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [clampView]);

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchDist.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const size = pointers.current.size;

    if (size === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      setView((v) => (v.scale <= 1 ? v : clampView(v.scale, v.x + dx, v.y + dy)));
      return;
    }

    if (size === 2) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist.current && dist > 0) {
        const ratio = dist / pinchDist.current;
        const rect = containerRef.current?.getBoundingClientRect();
        const mx = (a.x + b.x) / 2 - (rect?.left ?? 0);
        const my = (a.y + b.y) / 2 - (rect?.top ?? 0);
        setView((v) => {
          const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * ratio));
          const k = next / v.scale;
          return clampView(next, mx - (mx - v.x) * k, my - (my - v.y) * k);
        });
      }
      pinchDist.current = dist;
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchDist.current = null;
  }

  function onDoubleClick(e: React.MouseEvent) {
    const rect = containerRef.current?.getBoundingClientRect();
    const px = e.clientX - (rect?.left ?? 0);
    const py = e.clientY - (rect?.top ?? 0);
    setView((v) => (v.scale > 1 ? { scale: 1, x: 0, y: 0 } : clampView(2.5, px - px * 2.5, py - py * 2.5)));
  }

  function stepZoom(dir: 1 | -1) {
    const rect = containerRef.current?.getBoundingClientRect();
    const cx = (rect?.width ?? 0) / 2;
    const cy = (rect?.height ?? 0) / 2;
    zoomAt(view.scale * (dir === 1 ? 1.4 : 1 / 1.4), cx, cy);
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      className={cn(
        "relative touch-none select-none overflow-hidden",
        view.scale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
        className,
      )}
    >
      <div
        className="absolute inset-0 will-change-transform"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          transformOrigin: "0 0",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className={cn("h-full w-full object-contain", imageClassName)}
        />
      </div>

      <div className="absolute bottom-2 right-2 flex gap-1">
        <ZoomButton label="Acercar" onClick={() => stepZoom(1)}>
          <Plus className="size-4" />
        </ZoomButton>
        <ZoomButton label="Alejar" onClick={() => stepZoom(-1)}>
          <Minus className="size-4" />
        </ZoomButton>
        <ZoomButton label="Restablecer" onClick={() => setView({ scale: 1, x: 0, y: 0 })}>
          <Maximize2 className="size-4" />
        </ZoomButton>
      </div>
    </div>
  );
}

function ZoomButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        GHOST_BUTTON_CLASS,
        "flex size-8 items-center justify-center rounded-lg bg-black/40 backdrop-blur hover:bg-black/60",
      )}
    >
      {children}
    </button>
  );
}
