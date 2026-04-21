import { BrandIcon } from "@/components/app/brand-icon";
import { SECTION_EYEBROW_CLASS } from "@/lib/constants/styles";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-10 pt-14 sm:pt-20">
        <header className="flex flex-col items-center gap-3 text-center">
          <BrandIcon
            className="h-11 w-11 rounded-2xl shadow-[0_10px_24px_rgba(0,0,0,0.24)]"
            priority
          />
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              Zeta
            </h1>
            <p className={SECTION_EYEBROW_CLASS}>Tu plata, sin ruido.</p>
          </div>
        </header>

        <main className="mt-10 flex-1">{children}</main>
      </div>
    </div>
  );
}
