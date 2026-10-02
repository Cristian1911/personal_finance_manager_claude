import { useEffect } from "react";
import { AppState } from "react-native";
import { onLocalCommand } from "../engine/run-local";
import { syncV2 } from "./sync";

/** After a local write, wait this long so a burst (Anotar + Deshacer) goes in one push. */
const DEBOUNCE_MS = 1500;

/** Keeps the phone and the server in step: on open, back to the app, and after local writes. */
export function useV2Sync(userId: string): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const soon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void syncV2(userId), DEBOUNCE_MS);
    };
    void syncV2(userId);
    const offWrite = onLocalCommand(soon);
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") void syncV2(userId); });
    return () => {
      if (timer) clearTimeout(timer);
      offWrite();
      sub.remove();
    };
  }, [userId]);
}
