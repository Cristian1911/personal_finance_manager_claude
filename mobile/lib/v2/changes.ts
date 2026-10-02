import { useEffect, useRef } from "react";

/**
 * "Something changed in the v2 database": Anotar and Deshacer close a sheet
 * without moving focus, so screens that only reload on focus would show the
 * old number. Screens subscribe; writers call notifyV2Change().
 */
const listeners = new Set<() => void>();

export function notifyV2Change(): void {
  for (const l of listeners) l();
}

export function useV2Changes(onChange: () => void): void {
  const latest = useRef(onChange);
  latest.current = onChange;
  useEffect(() => {
    const l = () => latest.current();
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
}
