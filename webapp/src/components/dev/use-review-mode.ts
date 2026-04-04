"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const STORAGE_KEY = "zeta-review-mode";

export function useReviewMode() {
  const searchParams = useSearchParams();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const urlParam = searchParams.get("review");
    if (urlParam === "true") {
      setEnabled(true);
      localStorage.setItem(STORAGE_KEY, "true");
      return;
    }
    setEnabled(localStorage.getItem(STORAGE_KEY) === "true");
  }, [searchParams]);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem(STORAGE_KEY, next ? "true" : "false");
  }

  return { enabled, toggle };
}
