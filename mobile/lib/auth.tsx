import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { supabase } from "./supabase";
import { disableDemoMode, isDemoModeEnabled } from "./demo-mode";
import { clearDatabase } from "./db/database";
import { syncAll } from "./sync/engine";

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

const LAST_AUTH_USER_KEY = "venti5_last_auth_user_id";

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

  async function resolveSessionSafely(): Promise<Session | null> {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        const message = String(error.message ?? "");
        if (message.toLowerCase().includes("refresh token")) {
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
          return null;
        }
      }
      return data.session;
    } catch (error) {
      const message = String((error as Error)?.message ?? "");
      if (message.toLowerCase().includes("refresh token")) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        return null;
      }
      return null;
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
      return;
    }

    await SecureStore.setItemAsync(LAST_AUTH_USER_KEY, nextUserId).catch(() => {});
  }

  useEffect(() => {
    (async () => {
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

      if (resolvedSession?.user) {
        const userId = resolvedSession.user.id;
        if (autoSyncedUserRef.current !== userId) {
          autoSyncedUserRef.current = userId;
          syncAll().catch((error) => {
            console.warn("Initial sync failed:", error);
          });
        }
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (nextSession?.user && demoModeRef.current) {
        await clearDatabase();
      }
      await handleUserBoundary(nextSession);
      setSession(nextSession);
      if (nextSession) {
        setDemoMode(false);
        disableDemoMode().catch(() => {});

        const userId = nextSession.user.id;
        if (autoSyncedUserRef.current !== userId) {
          autoSyncedUserRef.current = userId;
          syncAll().catch((error) => {
            console.warn("Post-auth sync failed:", error);
          });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, demoMode, setDemoMode }}>
      {children}
    </AuthContext.Provider>
  );
}
