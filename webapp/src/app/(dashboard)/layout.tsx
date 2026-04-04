import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserSafely } from "@/lib/supabase/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getAttentionSnapshot } from "@/actions/attention";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import { MobileTabBar } from "@/components/mobile/v2/mobile-tab-bar";
import { PageTransition } from "@/components/ui/page-transition";
import { KeyboardInsetProvider } from "@/hooks/use-keyboard-inset";
import { DevOverlay } from "@/components/dev/dev-overlay";

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

  const [attentionSnapshot, accountsResult, categoriesResult] = await Promise.all([
    getAttentionSnapshot(),
    getAccounts(),
    getCategories(),
  ]);

  const accounts = accountsResult.success ? accountsResult.data : [];
  const categories = categoriesResult.success ? categoriesResult.data : [];

  return (
    <div className="flex min-h-screen">
      <Sidebar attentionSnapshot={attentionSnapshot} />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop topbar — hidden on mobile */}
        <div className="hidden lg:block">
          <Topbar profile={profile} attentionSnapshot={attentionSnapshot} />
        </div>
        {/* Mobile header — v2 */}
        <MobileHeader
          variant="dashboard"
          name={profile.full_name}
          email={profile.email}
        />

        <KeyboardInsetProvider>
          <main className="flex-1 overflow-x-hidden p-4 lg:p-6 pb-20 lg:pb-6">
            <Suspense>
              <PageTransition>
                {children}
              </PageTransition>
            </Suspense>
          </main>

          {/* Mobile bottom navigation — v2 tab bar with center "+" */}
          <MobileTabBar accounts={accounts} categories={categories} />
        </KeyboardInsetProvider>
      </div>
      {IS_DEV && <DevOverlay />}
    </div>
  );
}
