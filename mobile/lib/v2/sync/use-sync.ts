import { useEffect } from "react";
import { AppState } from "react-native";
import { onLocalCommand } from "../engine/run-local";
import { syncV2, type SyncOutcome } from "./sync";

/** After a local write, wait this long so a burst (Anotar + Deshacer) goes in one push. */
const DEBOUNCE_MS = 1500;
/** Offline or with work left: try again after this long (while the app is open). */
const RETRY_MS = 30_000;

/** Keeps the phone and the server in step: on open, back to the app, and after local writes. */
export function useV2Sync(userId: string): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const sync = () => {
      void syncV2(userId).then((o: SyncOutcome) => {
        if (o === "offline" || o === "pending" || o === "error") schedule(RETRY_MS);
      });
    };
    const schedule = (ms: number) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(sync, ms);
    };
    const soon = () => schedule(DEBOUNCE_MS);
    sync();
    const offWrite = onLocalCommand(soon);
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") sync(); });
    return () => {
      if (timer) clearTimeout(timer);
      offWrite();
      sub.remove();
    };
  }, [userId]);
}
