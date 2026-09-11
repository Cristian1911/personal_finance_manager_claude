import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { readPersistedSession, supabase } from "./supabase";
import { disableDemoMode, isDemoModeEnabled } from "./demo-mode";
import { clearDatabase } from "./db/database";
import { requestSync, syncAll } from "./sync/engine";
import { getLocalProfile } from "./profile";
import {
  LOCATION_FEATURE_ENABLED,
  getCurrentPermissionLevel,
  startBackgroundLocationTracking,
} from "./services/location";
import { reschedulePaymentReminders } from "./services/notifications";

type AuthContextType = {
  session: Session | null;
  loading: boolean;
  demoMode: boolean;
  setDemoMode: (value: boolean) => void;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
  demoMode: false,
  setDemoMode: () => {},
});

const LAST_AUTH_USER_KEY = "zeta_last_auth_user_id";

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const autoSyncedUserRef = useRef<string | null>(null);
  const demoModeRef = useRef(false);

  useEffect(() => {
    demoModeRef.current = demoMode;
  }, [demoMode]);

  /**
   * "Invalid Refresh Token" / "Refresh Token Not Found" — the server rejected
   * the token, so the session is genuinely dead. Anything else (network down,
   * DNS, timeout, 5xx) is a *retryable* failure and must not log the user out.
   */
  function isDeadRefreshToken(error: unknown): boolean {
    const message = String((error as Error)?.message ?? "").toLowerCase();
    const code = String((error as { code?: string })?.code ?? "").toLowerCase();
    return (
      code === "refresh_token_not_found" ||
      code === "refresh_token_already_used" ||
      (message.includes("refresh token") && !message.includes("fetch"))
    );
  }

  async function resolveSessionSafely(): Promise<Session | null> {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (data.session) return data.session;
      if (error && isDeadRefreshToken(error)) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        return null;
      }
      // getSession() returned nothing but did not tell us the session is
      // dead: offline with an expired access token. The SDK keeps the session
      // on disk and refreshes it once the network is back, so keep the user
      // signed in against their local SQLite instead of bouncing to login.
      return await readPersistedSession();
    } catch (error) {
      if (isDeadRefreshToken(error)) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        return null;
      }
      return await readPersistedSession();
    }
  }

  async function handleUserBoundary(nextSession: Session | null) {
    const previousUserId = await SecureStore.getItemAsync(LAST_AUTH_USER_KEY);
    const nextUserId = nextSession?.user?.id ?? null;

    if (previousUserId && nextUserId && previousUserId !== nextUserId) {
      await clearDatabase();
      autoSyncedUserRef.current = null;
    }

    if (!nextUserId) {
      await SecureStore.deleteItemAsync(LAST_AUTH_USER_KEY).catch(() => {});
      // El proceso sobrevive al logout, así que este ref sobrevive con él. Sin
      // limpiarlo, volver a entrar con el MISMO usuario hacía que
      // triggerInitialSyncOnce saliera por su propio guard y nunca sincronizara
      // — y como el logout ya vació SQLite, la sesión arrancaba en cero hasta
      // que el usuario hiciera pull-to-refresh a mano.
      autoSyncedUserRef.current = null;
      return;
    }

    await SecureStore.setItemAsync(LAST_AUTH_USER_KEY, nextUserId).catch(() => {});
  }

  function triggerInitialSyncOnce(nextSession: Session | null, logLabel: string) {
    if (!nextSession?.user) return;
    const userId = nextSession.user.id;
    if (autoSyncedUserRef.current === userId) return;
    autoSyncedUserRef.current = userId;
    syncAll()
      .then(() => maybeResumeLocationTracking())
      .then(() => reschedulePaymentReminders())
      .catch((error) => {
        console.warn(logLabel, error);
      });
  }

  async function maybeResumeLocationTracking() {
    if (!LOCATION_FEATURE_ENABLED) return;
    try {
      const profile = await getLocalProfile();
      if (profile?.location_tracking_enabled !== 1) return;
      const level = await getCurrentPermissionLevel();
      if (level === "background") {
        await startBackgroundLocationTracking();
      }
    } catch (err) {
      if (__DEV__) console.warn("Resume location tracking failed:", err);
    }
  }

  async function initializeAuthState() {
    const [resolvedSession, demoEnabled] = await Promise.all([
      resolveSessionSafely(),
      isDemoModeEnabled(),
    ]);

    if (resolvedSession?.user && demoEnabled) {
      await clearDatabase();
      await disableDemoMode().catch(() => {});
    }

    await handleUserBoundary(resolvedSession);
    setSession(resolvedSession);
    setDemoMode(demoEnabled && !resolvedSession?.user);
    setLoading(false);

    triggerInitialSyncOnce(resolvedSession, "Initial sync failed:");
  }

  async function handleAuthStateChange(event: AuthChangeEvent, nextSession: Session | null) {
    // The SDK's own startup pass can report "no session" offline for the
    // same reason getSession() does (refresh failed on the network). The
    // initial state is decided by initializeAuthState, which already applied
    // the persisted-session fallback — don't let this null overwrite it.
    if (event === "INITIAL_SESSION" && !nextSession) return;

    if (nextSession?.user && demoModeRef.current) {
      await clearDatabase();
    }

    await handleUserBoundary(nextSession);
    setSession(nextSession);

    if (!nextSession) return;

    setDemoMode(false);
    disableDemoMode().catch(() => {});
    triggerInitialSyncOnce(nextSession, "Post-auth sync failed:");

    // A refreshed token is the clearest "we are back online" signal there
    // is: flush whatever was captured offline.
    if (event === "TOKEN_REFRESHED") requestSync("token-refreshed");
  }

  useEffect(() => {
    initializeAuthState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      await handleAuthStateChange(event, nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, demoMode, setDemoMode }}>
      {children}
    </AuthContext.Provider>
  );
}
