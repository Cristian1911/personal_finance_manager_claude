import { redirect } from "next/navigation";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { BrandIcon } from "@/components/app/brand-icon";
import { SECTION_EYEBROW_CLASS } from "@/lib/constants/styles";

export default async function OnboardingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { supabase, user } = await getAuthenticatedClient();
    if (!user) {
        redirect("/login");
    }
    const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .single();
    if (profile?.onboarding_completed) {
        redirect("/dashboard");
    }

    return (
        <div className="min-h-screen w-full bg-background text-foreground">
            <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-10 pt-10 sm:pt-14">
                <header className="flex items-center gap-2">
                    <BrandIcon className="h-7 w-7 rounded-xl" priority />
                    <div className="flex flex-col leading-tight">
                        <span className="text-base font-extrabold tracking-tight text-foreground">Zeta</span>
                        <span className={SECTION_EYEBROW_CLASS}>Configuración</span>
                    </div>
                </header>
                <main className="mt-6 flex-1">{children}</main>
            </div>
        </div>
    );
}
