"use client";

import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";

export type EmptyStateAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
};

export interface EmptyStateProps {
  /** Rendered icon element (e.g. `<Inbox className="size-6" strokeWidth={1.5} />`).
   *  Pass an element, not a component reference — EmptyState is a client
   *  component and a bare component function can't cross the server→client
   *  boundary when used from a Server Component. */
  icon: React.ReactNode;
  /** Value-first title — what the user gains, not "no hay nada". */
  title: string;
  /** Answers "¿qué hago primero?". */
  description?: string;
  /** Primary CTA (brass). */
  primary?: EmptyStateAction;
  /** Secondary CTA (ghost). */
  secondary?: EmptyStateAction;
  /** Extra slot under the actions — e.g. a subtle text link ("Ver suscripciones detectadas"). */
  footer?: React.ReactNode;
  /** Dashed bordered card (default). false = bare centered block for full-screen states. */
  bordered?: boolean;
  className?: string;
}

function ActionButton({
  action,
  variant,
}: {
  action: EmptyStateAction;
  variant: "brass" | "ghost";
}) {
  const Icon = action.icon;
  const content = (
    <>
      {Icon ? <Icon className="size-4" strokeWidth={1.5} /> : null}
      {action.label}
    </>
  );
  const className = cn(
    "h-10 gap-2",
    variant === "brass" ? BRASS_BUTTON_CLASS : GHOST_BUTTON_CLASS,
  );

  if (action.href) {
    return (
      <Button
        asChild
        variant={variant === "ghost" ? "outline" : "default"}
        className={className}
      >
        <Link href={action.href}>{content}</Link>
      </Button>
    );
  }
  return (
    <Button
      type="button"
      variant={variant === "ghost" ? "outline" : "default"}
      className={className}
      onClick={action.onClick}
    >
      {content}
    </Button>
  );
}

/**
 * Guided-experience EmptyState primitive (design "Experiencia guiada" · D3).
 * A blank surface never just says "no hay nada" — it states the value,
 * answers "¿qué hago primero?", and offers the action.
 */
export function EmptyState({
  icon,
  title,
  description,
  primary,
  secondary,
  footer,
  bordered = true,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        bordered && "rounded-2xl border border-dashed border-white/6 bg-white/[0.01]",
        className,
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-2xl border border-z-brass/24 bg-z-brass/12 text-z-brass [&>svg]:size-6">
        {icon}
      </span>
      <p className="text-lg font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {(primary || secondary) && (
        <div className="mt-2 flex flex-col items-center gap-2">
          {primary ? <ActionButton action={primary} variant="brass" /> : null}
          {secondary ? <ActionButton action={secondary} variant="ghost" /> : null}
        </div>
      )}
      {footer ? <div className="mt-1">{footer}</div> : null}
    </div>
  );
}
