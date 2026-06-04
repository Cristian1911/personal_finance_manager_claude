import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserSafely } from "@/lib/supabase/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getProfile } from "@/actions/profile";
import { getAttentionSnapshot } from "@/actions/attention";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { getDestinatarios } from "@/actions/destinatarios";
import { getTagGroups } from "@/actions/tags";
import { AppDataProvider } from "@/components/providers/app-data-provider";
import { NavFocusProvider } from "@/components/providers/nav-focus-provider";
import { MobileTabBar } from "@/components/mobile/v2/mobile-tab-bar";
import { MobileShellProvider } from "@/components/mobile/v2/mobile-shell-provider";
import { TabBarVisibilityProvider } from "@/components/mobile/v2/tab-bar-visibility-provider";
import { FocusModeAccent } from "@/components/mobile/v2/focus-mode-accent";
import { MobileSheetProvider } from "@/components/mobile/mobile-sheet-provider";
import { PageTransition } from "@/components/ui/page-transition";
import { KeyboardInsetProvider } from "@/hooks/use-keyboard-inset";
import { DemoBanner } from "@/components/dashboard/demo-banner";
import { GuestBanner } from "@/components/dashboard/guest-banner";
import { MOBILE_TAB_BAR_CLEARANCE_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";

const DevOverlay = dynamic(
  () => import("@/components/dev/dev-overlay").then((m) => ({ default: m.DevOverlay })),
);


export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection(); // signal dynamic rendering — auth requires cookies
  const supabase = await createClient();
  const user = await getUserSafely(supabase);

  if (!user) {
    redirect("/login");
  }

  const [
    profileResult,
    attentionSnapshot,
    accountsResult,
    categoriesResult,
    outflowCategoriesResult,
    destinatariosResult,
    tagGroupsResult,
  ] = await Promise.all([
    getProfile(),
    getAttentionSnapshot(),
    getAccounts(),
    getCategories(),
    getCategories("OUTFLOW"),
    getDestinatarios(),
    getTagGroups(),
  ]);

  const profile = profileResult.success ? profileResult.data : null;

  if (!profile) {
    redirect("/login");
  }

  if (!profile.onboarding_completed) {
    redirect("/onboarding");
  }

  const accounts = accountsResult.success ? accountsResult.data : [];
  const categories = categoriesResult.success ? categoriesResult.data : [];
  const appData = {
    accounts,
    categories,
    outflowCategories: outflowCategoriesResult.success ? outflowCategoriesResult.data ?? [] : [],
    destinatarios: (destinatariosResult.success ? destinatariosResult.data : []).map(
      (d) => ({ id: d.id, name: d.name, is_active: d.is_active, kind: d.kind })
    ),
    tagGroups: tagGroupsResult.success ? tagGroupsResult.data : [],
  };
  const attentionCount = attentionSnapshot.totalAction;
  const attentionSummary =
    attentionSnapshot.totalAction > 0
      ? attentionSnapshot.signals.find((signal) => signal.priority === "action")?.label
        ?? `${attentionSnapshot.totalAction} pendientes requieren atención`
      : attentionSnapshot.totalSuggestion > 0
        ? `${attentionSnapshot.totalSuggestion} sugerencia${attentionSnapshot.totalSuggestion === 1 ? "" : "s"} para revisar`
        : "Todo en orden por ahora";

  return (
    <div className="flex min-h-screen">
      <Sidebar attentionSnapshot={attentionSnapshot} />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop topbar — hidden on mobile */}
        <div className="hidden lg:block">
          <Topbar profile={profile} attentionSnapshot={attentionSnapshot} />
        </div>
        <KeyboardInsetProvider>
          <MobileShellProvider
            value={{
              name: profile.full_name,
              email: profile.email ?? user.email ?? null,
              attentionCount,
              attentionSummary,
            }}
          >
            <AppDataProvider data={appData}>
              <NavFocusProvider value={profile.nav_focus}>
              <TabBarVisibilityProvider>
              <MobileSheetProvider>
                <main className={cn("flex-1 overflow-x-hidden p-4 lg:p-6 lg:pb-6", MOBILE_TAB_BAR_CLEARANCE_CLASS)}>
                  {profile.demo_mode ? (
                    <DemoBanner isAnonymous={user.is_anonymous ?? false} />
                  ) : user.is_anonymous ? (
                    <GuestBanner />
                  ) : null}
                  <PageTransition>
                    {children}
                  </PageTransition>
                </main>

                <MobileTabBar />
                <FocusModeAccent />
              </MobileSheetProvider>
              </TabBarVisibilityProvider>
              </NavFocusProvider>
            </AppDataProvider>
          </MobileShellProvider>
        </KeyboardInsetProvider>
      </div>
      <DevOverlay />
    </div>
  );
}
