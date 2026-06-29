import { redirect } from "next/navigation";
import { getProfile } from "@/actions/profile";
import { BrandIcon } from "@/components/app/brand-icon";
import { SECTION_EYEBROW_CLASS } from "@/lib/constants/styles";

export default async function OnboardingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const profile = await getProfile();
    if (!profile.success) {
        redirect("/login");
    }
    if (profile.data.onboarding_completed) {
        redirect("/dashboard");
    }

    return (
        <div className="min-h-dvh w-full bg-background text-foreground">
            <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10 pt-10 sm:pt-14">
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
