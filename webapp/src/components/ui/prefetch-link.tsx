"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

type PrefetchLinkProps = ComponentProps<typeof Link>;

export function PrefetchLink({ onMouseEnter, ...props }: PrefetchLinkProps) {
  const router = useRouter();

  return (
    <Link
      {...props}
      onMouseEnter={(e) => {
        const href = typeof props.href === "string" ? props.href : props.href.pathname;
        if (href) router.prefetch(href);
        onMouseEnter?.(e);
      }}
    />
  );
}
