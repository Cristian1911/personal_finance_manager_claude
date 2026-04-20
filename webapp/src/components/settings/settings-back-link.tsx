import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function SettingsBackLink() {
  return (
    <Link
      href="/settings"
      className="hidden lg:inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" />
      Volver a Ajustes
    </Link>
  );
}
