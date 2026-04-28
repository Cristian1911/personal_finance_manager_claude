"use client";

import { createContext, useContext } from "react";
import type { Database } from "@/types/database";

export type NavFocus = Database["public"]["Enums"]["nav_focus"];

const NavFocusContext = createContext<NavFocus>("PLAN");

export function NavFocusProvider({
  value,
  children,
}: {
  value: NavFocus | null | undefined;
  children: React.ReactNode;
}) {
  return (
    <NavFocusContext.Provider value={value ?? "PLAN"}>
      {children}
    </NavFocusContext.Provider>
  );
}

export function useNavFocus(): NavFocus {
  return useContext(NavFocusContext);
}
