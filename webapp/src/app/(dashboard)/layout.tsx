import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserSafely } from "@/lib/supabase/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getUncategorizedCount } from "@/actions/categorize";

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

  const uncategorizedCount = await getUncategorizedCount();

  return (
    <div className="flex min-h-screen">
      <Sidebar uncategorizedCount={uncategorizedCount} />
      <div className="flex-1 flex flex-col">
        <Topbar profile={profile} uncategorizedCount={uncategorizedCount} />
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
