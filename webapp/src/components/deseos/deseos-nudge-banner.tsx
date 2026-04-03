"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { dismissNudge } from "@/actions/wishlist";
import type { WishlistNudge } from "@/actions/wishlist";
import { Button } from "@/components/ui/button";

const NUDGE_EMOJI: Record<WishlistNudge["type"], string> = {
  debt_milestone: "\uD83C\uDFC6",
  score_transition: "\u2728",
  budget_surplus: "\uD83D\uDCB0",
  desire_maturity: "\u23F3",
};

type DeseosNudgeBannerProps = {
  nudge: WishlistNudge;
};

export function DeseosNudgeBanner({ nudge }: DeseosNudgeBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDismiss() {
    setDismissed(true);
    startTransition(async () => {
      await dismissNudge(nudge.itemId);
    });
  }

  if (dismissed) return null;

  const emoji = NUDGE_EMOJI[nudge.type] ?? "\uD83D\uDCA1";

  return (
    <div className="flex items-start gap-3 rounded-lg border border-z-brass/20 bg-z-brass/5 px-4 py-3">
      <span className="mt-0.5 text-lg flex-shrink-0">{emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{nudge.itemName}</p>
        <p className="text-xs text-muted-foreground">{nudge.message}</p>
      </div>
      <Button
        size="icon-xs"
        variant="ghost"
        className="flex-shrink-0 text-muted-foreground hover:text-foreground"
        onClick={handleDismiss}
        disabled={isPending}
      >
        <X className="size-3" />
      </Button>
    </div>
  );
}
