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
import { MobileTabBar } from "@/components/mobile/v2/mobile-tab-bar";
import { MobileShellProvider } from "@/components/mobile/v2/mobile-shell-provider";
import { PageTransition } from "@/components/ui/page-transition";
import { KeyboardInsetProvider } from "@/hooks/use-keyboard-inset";

const DevOverlay = dynamic(
  () => import("@/components/dev/dev-overlay").then((m) => ({ default: m.DevOverlay })),
);

const IS_DEV = process.env.NODE_ENV === "development";

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

  const [profileResult, attentionSnapshot, accountsResult, categoriesResult] = await Promise.all([
    getProfile(),
    getAttentionSnapshot(),
    getAccounts(),
    getCategories(),
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
            <main className="flex-1 overflow-x-hidden p-4 pb-20 lg:p-6 lg:pb-6">
              <PageTransition>
                {children}
              </PageTransition>
            </main>

            <MobileTabBar accounts={accounts} categories={categories} />
          </MobileShellProvider>
        </KeyboardInsetProvider>
      </div>
      {IS_DEV && <DevOverlay />}
    </div>
  );
}
