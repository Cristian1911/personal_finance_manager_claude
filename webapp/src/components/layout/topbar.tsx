import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";
import type { Profile } from "@/types/domain";

export function Topbar({ profile }: { profile: Profile }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card px-4 lg:px-6">
      <MobileNav />
      <div className="flex-1" />
      <UserMenu profile={profile} />
    </header>
  );
}
