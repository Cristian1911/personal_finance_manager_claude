import { MobileNav } from "./mobile-nav";
import { QuickViewMenu } from "./quick-view-menu";
import type { Profile } from "@/types/domain";
import type { AttentionSnapshot } from "@/types/attention";

interface TopbarProps {
  profile: Profile;
  attentionSnapshot?: AttentionSnapshot;
}

export function Topbar({ profile, attentionSnapshot }: TopbarProps) {
  const snapshot = attentionSnapshot ?? { signals: [], totalAction: 0, totalSuggestion: 0, perPage: {} };
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card px-4 lg:px-6">
      <MobileNav attentionSnapshot={attentionSnapshot} />
      <div className="flex-1" />
      <QuickViewMenu profile={profile} attentionSnapshot={snapshot} />
    </header>
  );
}
