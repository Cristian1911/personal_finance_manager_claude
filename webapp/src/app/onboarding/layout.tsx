export default function OnboardingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gradient-to-b from-emerald-50 via-background to-background p-4 md:p-6 lg:p-8">
            {children}
        </div>
    );
}
