"use client";

import { useCallback, useState } from "react";
import { ModoWizard, type ModoWizardProps } from "./modo-wizard";

/**
 * Mounts the wizard under a key that changes every time it is finished or
 * abandoned. Issue #387 again: the client Router Cache can hand `/modos/nuevo`
 * back with its React state intact (last step, the trip just created), so
 * "Nuevo viaje" from the FAB showed the previous wizard filled in. A fresh
 * key forces a clean mount with only the URL presets.
 */
export function ModoWizardHost(props: Omit<ModoWizardProps, "onDone" | "onLeave">) {
  const [formKey, setFormKey] = useState(0);
  const reset = useCallback(() => setFormKey((k) => k + 1), []);
  return <ModoWizard key={formKey} {...props} onDone={reset} onLeave={reset} />;
}
