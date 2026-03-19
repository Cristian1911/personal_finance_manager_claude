import type { ReactNode } from "react";

export function StaggerList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function FadeIn({ children, className }: { children: ReactNode; className?: string; delay?: number }) {
  return <div className={className}>{children}</div>;
}
