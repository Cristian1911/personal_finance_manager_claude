import { cn } from "@/lib/utils";

/** Initial-letter bubble for a person (destinatario kind=person). Brass tint, 36px. */
export function PersonAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-z-brass/15 text-sm font-semibold text-z-brass",
        className,
      )}
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
