import type { Profile } from "@/types/domain";
import type { AttentionSnapshot } from "@/types/attention";
import { QuickViewMenu } from "@/components/layout/quick-view-menu";

interface MobileTopbarProps {
  profile: Profile;
  attentionSnapshot: AttentionSnapshot;
}

export function MobileTopbar({ profile, attentionSnapshot }: MobileTopbarProps) {
  const firstName = profile.full_name?.split(" ")[0];
  const greeting = firstName ? `Hola, ${firstName}` : "Hola";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:hidden">
      <span className="text-sm font-medium text-muted-foreground">
        {greeting}
      </span>
      <QuickViewMenu profile={profile} attentionSnapshot={attentionSnapshot} />
    </header>
  );
}
