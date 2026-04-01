import { BrandIcon } from "@/components/app/brand-icon";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex items-center gap-2">
            <BrandIcon
              className="h-9 w-9 rounded-2xl shadow-[0_10px_24px_rgba(0,0,0,0.16)]"
              priority
            />
            <h1 className="text-2xl font-bold tracking-tight">
              Zeta
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Controla tu dinero con claridad diaria
          </p>
        </div>
        <div className="bg-card rounded-lg border shadow-sm p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
