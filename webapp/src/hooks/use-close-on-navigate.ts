"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Calls `close()` whenever the route changes. */
export function useCloseOnNavigate(close: () => void) {
  const pathname = usePathname();
  const prev = useRef(pathname);

  useEffect(() => {
    if (prev.current !== pathname) {
      close();
      prev.current = pathname;
    }
  }, [pathname, close]);
}
