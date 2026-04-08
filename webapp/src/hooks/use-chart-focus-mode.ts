// src/hooks/use-chart-focus-mode.ts
"use client";

import { useEffect, useCallback, useState } from "react";

export function useChartFocusMode(isExpanded: boolean) {
  const [overlayVisible, setOverlayVisible] = useState(false);

  useEffect(() => {
    if (isExpanded) {
      document.body.style.overflow = "hidden";
      const timer = setTimeout(() => setOverlayVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      document.body.style.overflow = "";
      setOverlayVisible(false);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isExpanded]);

  const handleOverlayClick = useCallback((onCollapse: () => void) => {
    return () => onCollapse();
  }, []);

  return { overlayVisible, handleOverlayClick };
}
