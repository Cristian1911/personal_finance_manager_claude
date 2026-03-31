import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";
import type { Profile } from "@/types/domain";
import type { AttentionSnapshot } from "@/types/attention";

interface TopbarProps {
  profile: Profile;
  attentionSnapshot?: AttentionSnapshot;
}

export function Topbar({ profile, attentionSnapshot }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card px-4 lg:px-6">
      <MobileNav attentionSnapshot={attentionSnapshot} />
      <div className="flex-1" />
      <UserMenu profile={profile} />
    </header>
  );
}
