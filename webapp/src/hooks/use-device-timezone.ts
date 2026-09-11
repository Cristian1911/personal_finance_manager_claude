"use client";

import { useEffect, useState } from "react";
import { getDeviceTimeZone } from "@zeta/shared";

/**
 * The browser's IANA timezone, resolved on the client after mount.
 *
 * Returns null during SSR and the first client render: the server runs in
 * the container's timezone (UTC) and reading `Intl` during render would make
 * the two disagree and throw a hydration mismatch. Consumers render nothing
 * until it resolves, which is the right default for a hint anyway.
 */
export function useDeviceTimeZone(): string | null {
  const [timeZone, setTimeZone] = useState<string | null>(null);
  useEffect(() => {
    // The device clock/timezone is an external system; it can only be read
    // after hydration. Mount-only, so no cascading-render risk.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimeZone(getDeviceTimeZone());
  }, []);
  return timeZone;
}
