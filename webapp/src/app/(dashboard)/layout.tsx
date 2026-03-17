import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserSafely } from "@/lib/supabase/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getUncategorizedCount } from "@/actions/categorize";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { MobileTopbar } from "@/components/mobile/mobile-topbar";
import { BottomTabBar } from "@/components/mobile/bottom-tab-bar";
import { MobileSheetProvider } from "@/components/mobile/mobile-sheet-provider";
import { PageTransition } from "@/components/ui/page-transition";
import type { TabConfig } from "@/types/dashboard-config";
import { getDefaultConfigForProfile } from "@/lib/dashboard-config-defaults";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const user = await getUserSafely(supabase);

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  if (!profile.onboarding_completed) {
    redirect("/onboarding");
  }

  const [uncategorizedCount, accountsResult, categoriesResult] =
    await Promise.all([
      getUncategorizedCount(),
      getAccounts(),
      getCategories(),
    ]);

  const accounts = accountsResult.success ? accountsResult.data : [];
  const categories = categoriesResult.success ? categoriesResult.data : [];

  // Dashboard config: use DB value or fall back to purpose-driven defaults
  const dashboardConfig = profile.dashboard_config
    ? (profile.dashboard_config as unknown as { tabs: TabConfig[] })
    : getDefaultConfigForProfile(profile.app_purpose);
  const tabConfig = dashboardConfig.tabs;

  return (
    <div className="flex min-h-screen">
      <Sidebar uncategorizedCount={uncategorizedCount} />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop topbar — hidden on mobile */}
        <div className="hidden lg:block">
          <Topbar profile={profile} uncategorizedCount={uncategorizedCount} />
        </div>
        {/* Mobile topbar */}
        <MobileTopbar profile={profile} />

        <main className="flex-1 overflow-x-hidden p-4 lg:p-6 pb-20 lg:pb-6">
          <MobileSheetProvider accounts={accounts} categories={categories}>
            <PageTransition>
              {children}
            </PageTransition>
          </MobileSheetProvider>
        </main>

        {/* Mobile bottom navigation */}
        <BottomTabBar uncategorizedCount={uncategorizedCount} tabConfig={tabConfig} />
      </div>
    </div>
  );
}
