"use client";

import { useEffect } from "react";
import { toast } from "sonner";

const RECOVERY_THROTTLE_MS = 10_000;
const LAST_RECOVERY_TS_KEY = "venti5:last-server-action-recovery-ts";

function extractMessage(reason: unknown): string {
  if (typeof reason === "string") return reason;
  if (
    reason &&
    typeof reason === "object" &&
    "message" in reason &&
    typeof (reason as { message?: unknown }).message === "string"
  ) {
    return (reason as { message: string }).message;
  }
  return "";
}

function isServerActionSkewError(message: string): boolean {
  if (!message) return false;
  return (
    message.includes("Failed to find Server Action") ||
    message.includes("Server Action") && message.includes("was not found on the server")
  );
}

function shouldRecoverNow(): boolean {
  if (typeof window === "undefined") return false;
  const now = Date.now();
  const lastRaw = window.sessionStorage.getItem(LAST_RECOVERY_TS_KEY);
  const last = lastRaw ? Number(lastRaw) : 0;
  if (Number.isFinite(last) && now - last < RECOVERY_THROTTLE_MS) {
    return false;
  }
  window.sessionStorage.setItem(LAST_RECOVERY_TS_KEY, String(now));
  return true;
}

function triggerRecovery() {
  if (!shouldRecoverNow()) return;
  toast.warning(
    "La app se actualizó. Vamos a recargar para sincronizar la sesión.",
    { duration: 2200 }
  );
  window.setTimeout(() => {
    window.location.reload();
  }, 600);
}

export function ServerActionRecovery() {
  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const message = extractMessage(event.reason);
      if (!isServerActionSkewError(message)) return;
      event.preventDefault();
      triggerRecovery();
    };

    const onError = (event: ErrorEvent) => {
      const message = extractMessage(event.error) || event.message;
      if (!isServerActionSkewError(message)) return;
      event.preventDefault();
      triggerRecovery();
    };

    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  return null;
}

