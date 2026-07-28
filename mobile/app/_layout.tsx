import "../global.css";

import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  DarkTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import {
  Inter_400Regular,
  Inter_400Regular_Italic,
  Inter_500Medium,
  Inter_500Medium_Italic,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { Kalam_700Bold } from "@expo-google-fonts/kalam";
import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, AppState, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";

// Dark theme forced — no color scheme toggle
import { AppKeyboardProvider } from "../components/common/AppKeyboardAwareScrollView";
import { AuthProvider, useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { getLocalProfile } from "../lib/profile";
import { BugReportProvider, BugReportViewShot } from "../lib/bugReportMode";
import { BugFAB } from "../components/BugFAB";
import {
  isBiometricsEnabled,
  isBackgroundReauthEnabled,
} from "../lib/biometrics";
import { BiometricLockScreen } from "../components/common/BiometricLockScreen";
import { ZetaThemeProvider } from "../lib/theme";
import { OnboardingStatusContext } from "../lib/onboarding-status";
import * as Notifications from "expo-notifications";
import {
  configureNotificationHandler,
  reschedulePaymentReminders,
} from "../lib/services/notifications";
import { trackProductEvent } from "../lib/analytics/product-events";
import { COLORS } from "../lib/constants/colors";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: "(tabs)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...FontAwesome.font,
    Inter_400Regular,
    Inter_400Regular_Italic,
    Inter_500Medium,
    Inter_500Medium_Italic,
    Inter_600SemiBold,
    Inter_700Bold,
    Kalam_700Bold,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <BugReportProvider>
        <AppKeyboardProvider>
          <RootLayoutNav />
        </AppKeyboardProvider>
      </BugReportProvider>
    </AuthProvider>
  );
}

// iOS formSheet warns for several flows in this app because their root
// layout contains more than the ScrollView/header pair that RNScreens
// expects. Using a standard modal keeps the UX stable without warnings.
function buildSheetOptions(_detents: [number, number]) {
  return {
    presentation: "modal" as const,
    headerShown: false,
  };
}

function RootLayoutNav() {
  const { session, loading, demoMode } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [biometricLocked, setBiometricLocked] = useState(false);
  const appState = useRef(AppState.currentState);
  const appOpenedRef = useRef(false);
  const routerRef = useRef(router);

  useEffect(() => {
    let mounted = true;

    async function checkOnboarding() {
      if (loading) return;
      if (demoMode) {
        if (!mounted) return;
        setNeedsOnboarding(false);
        setCheckingOnboarding(false);
        return;
      }
      if (!session) {
        if (!mounted) return;
        setNeedsOnboarding(false);
        setCheckingOnboarding(false);
        return;
      }

      // Local-first: read onboarding state from SQLite so launch never blocks
      // on the network (and works offline). The profile row is synced down, so
      // every launch after the first reads it locally and is instant.
      const localProfile = await getLocalProfile();
      if (localProfile) {
        if (!mounted) return;
        setNeedsOnboarding(!localProfile.onboarding_completed);
        setCheckingOnboarding(false);
        // Background re-check (non-blocking) to converge if onboarding was
        // completed on another device since the last sync. Offline → no-op.
        void supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", session.user.id)
          .maybeSingle()
          .then(
            ({ data }) => {
              if (mounted && data) setNeedsOnboarding(!data.onboarding_completed);
            },
            (err: unknown) => {
              // Offline / network failure on this non-blocking re-check is fine
              // — the local value already rendered. Log, don't reject.
              console.warn("Background onboarding re-check failed:", err);
            }
          );
        return;
      }

      // No local profile yet (fresh install before first sync) — fall back to
      // the network gate this once; the initial pull will populate SQLite.
      setCheckingOnboarding(true);
      const { data } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!mounted) return;
      setNeedsOnboarding(!data?.onboarding_completed);
      setCheckingOnboarding(false);
    }

    checkOnboarding();

    return () => {
      mounted = false;
    };
  }, [loading, session, demoMode]);

  useEffect(() => {
    if (!rootNavigationState?.key) return;
    if (loading || checkingOnboarding) return;

    const firstSegment = (segments[0] as string) ?? "";
    const inAuthGroup = firstSegment === "(auth)";
    const inOnboarding = firstSegment === "onboarding";

    if (!session && !demoMode && !inAuthGroup) {
      router.replace("/(auth)/login");
      return;
    }

    if (!session && demoMode) {
      if (inAuthGroup || inOnboarding) {
        router.replace("/(tabs)");
      }
      return;
    }

    if (!session) return;

    if (needsOnboarding && !inOnboarding) {
      router.replace("/onboarding" as never);
      return;
    }

    // Kick users out of the auth group once they're signed-in and complete.
    // Do NOT auto-kick from /onboarding: the onboarding screen navigates
    // itself out via its CTAs (calling markComplete() first). Without this
    // guardrail, a session/token refresh during persistOnboarding flips
    // `needsOnboarding=false` and yanks the user off StepComplete before
    // they can choose an onward path.
    if (!needsOnboarding && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [session, demoMode, loading, checkingOnboarding, needsOnboarding, segments, router, rootNavigationState?.key]);

  // Check biometrics on app launch (when session resolves)
  useEffect(() => {
    if (loading || !session || demoMode) return;
    isBiometricsEnabled().then((enabled) => {
      if (enabled) setBiometricLocked(true);
    });
  }, [loading, session, demoMode]);

  // Re-lock on background resume if configured
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextState === "active" &&
        session &&
        !demoMode
      ) {
        isBackgroundReauthEnabled().then((enabled) => {
          if (enabled) setBiometricLocked(true);
        });
        // Newly-synced occurrences (or ones that became due) are reflected on
        // resume — reschedule is a no-op when reminders are off.
        reschedulePaymentReminders();
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, [session, demoMode]);

  // Keep the latest router in a ref so the notification listener can deep-link
  // without re-subscribing on every navigation (router identity changes).
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  // Configure notification presentation once + deep-link on tap. Registered a
  // single time (empty deps) — re-registering per navigation churned listeners.
  useEffect(() => {
    configureNotificationHandler();
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const route = response.notification.request.content.data?.route;
        if (typeof route === "string") routerRef.current.push(route as never);
      },
    );
    return () => sub.remove();
  }, []);

  // Fire once per launch when an authenticated session resolves — the basic
  // engagement signal ("are people using the app"). Real users only.
  useEffect(() => {
    if (loading || demoMode || !session) return;
    if (appOpenedRef.current) return;
    appOpenedRef.current = true;
    trackProductEvent({ event_name: "app_opened" });
  }, [loading, session, demoMode]);

  const handleBiometricUnlock = useCallback(() => {
    setBiometricLocked(false);
  }, []);

  const onboardingStatusValue = useMemo(
    () => ({
      markComplete: () => setNeedsOnboarding(false),
      markIncomplete: () => setNeedsOnboarding(true),
    }),
    [],
  );

  const handleBiometricFallback = useCallback(async () => {
    setBiometricLocked(false);
    await supabase.auth.signOut();
  }, []);

  const isLoading = loading || checkingOnboarding;

  return (
    <SafeAreaProvider>
      <ZetaThemeProvider>
      <ThemeProvider value={DarkTheme}>
        <OnboardingStatusContext.Provider value={onboardingStatusValue}>
        <BugReportViewShot>
          {/* Every screen renders its own <MobileHeader>; a native header on
              top of it would be a duplicate. Default it off for the whole
              stack so routes that aren't declared below don't opt back in. */}
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen
              name="transaction/[id]"
              options={buildSheetOptions([0.72, 1.0])}
            />
            <Stack.Screen
              name="account/[id]"
              options={buildSheetOptions([0.72, 1.0])}
            />
            <Stack.Screen
              name="account/create"
              options={buildSheetOptions([0.72, 1.0])}
            />
            <Stack.Screen
              name="bug-report"
              options={buildSheetOptions([0.6, 0.95])}
            />
            <Stack.Screen
              name="annotate-screenshot"
              options={{
                presentation: "fullScreenModal",
                headerShown: false,
                animation: "slide_from_bottom",
              }}
            />
            <Stack.Screen
              name="subscriptions"
              options={buildSheetOptions([0.65, 1.0])}
            />
            <Stack.Screen
              name="capture"
              options={buildSheetOptions([0.72, 1.0])}
            />
            <Stack.Screen
              name="purchase-decision"
              options={buildSheetOptions([0.85, 1.0])}
            />
            {/* Card-presented screens (settings, accounts-list, categorizar,
                recurrentes, presupuesto, periodo, deudas/planificador, deseos,
                categories, destinatarios, personas…) need no entry here: card
                is the default presentation and the header is off stack-wide. */}
          </Stack>
        </BugReportViewShot>
        <BugFAB />
        {biometricLocked && !isLoading && (
          <BiometricLockScreen
            onUnlock={handleBiometricUnlock}
            onFallback={handleBiometricFallback}
          />
        )}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={COLORS.brass} />
          </View>
        )}
        </OnboardingStatusContext.Provider>
      </ThemeProvider>
      </ZetaThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.ink,
    alignItems: "center",
    justifyContent: "center",
  },
});
