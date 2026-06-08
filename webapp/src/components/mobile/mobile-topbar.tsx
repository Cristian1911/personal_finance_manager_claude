import type { Profile } from "@/types/domain";
import { QuickViewMenu } from "@/components/layout/quick-view-menu";

interface MobileTopbarProps {
  profile: Profile;
}

export function MobileTopbar({ profile }: MobileTopbarProps) {
  const firstName = profile.full_name?.split(" ")[0];
  const greeting = firstName ? `Hola, ${firstName}` : "Hola";

  return (
    <header className="sticky top-0 z-[var(--z-layer-sticky)] flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:hidden">
      <span className="text-sm font-medium text-muted-foreground">
        {greeting}
      </span>
      <QuickViewMenu profile={profile} />
    </header>
  );
}
