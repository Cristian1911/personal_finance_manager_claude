"use client";

import { createContext, useContext } from "react";

export interface MobileShellContextValue {
  name?: string | null;
  email?: string | null;
  attentionCount: number;
  attentionSummary: string;
}

const MobileShellContext = createContext<MobileShellContextValue | null>(null);

export function MobileShellProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: MobileShellContextValue;
}) {
  return (
    <MobileShellContext.Provider value={value}>
      {children}
    </MobileShellContext.Provider>
  );
}

export function useMobileShell() {
  return useContext(MobileShellContext);
}
