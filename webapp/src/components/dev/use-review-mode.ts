"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "zeta-review-mode";

export function useReviewMode() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("review") === "true") {
      setEnabled(true);
      localStorage.setItem(STORAGE_KEY, "true");
      return;
    }
    setEnabled(localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem(STORAGE_KEY, next ? "true" : "false");
  }

  return { enabled, toggle };
}
