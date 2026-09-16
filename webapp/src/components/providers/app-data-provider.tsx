"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type {
  Account,
  ActiveModo,
  CategoryWithChildren,
  CurrencyCode,
  DestinatarioKind,
  Tag,
  TagGroupWithTags,
} from "@/types/domain";

type DestinatarioOption = {
  id: string;
  name: string;
  is_active: boolean;
  kind: DestinatarioKind;
  /** Pre-fills Categoría in the transaction forms when this one is picked. */
  default_category_id: string | null;
};

interface AppData {
  accounts: Account[];
  categories: CategoryWithChildren[];
  outflowCategories: CategoryWithChildren[];
  destinatarios: DestinatarioOption[];
  tagGroups: TagGroupWithTags[];
  /** Profile currency — the target for "≈ en COP" conversion hints. */
  preferredCurrency: CurrencyCode;
  /** The trip flagged active, if any — drives the banner and tag preselection. */
  activeModo?: ActiveModo | null;
}

const AppDataContext = createContext<AppData | null>(null);

export function AppDataProvider({
  children,
  data,
}: {
  children: ReactNode;
  data: AppData;
}) {
  return (
    <AppDataContext.Provider value={data}>{children}</AppDataContext.Provider>
  );
}

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error("useAppData must be used within AppDataProvider");
  }
  return ctx;
}

export function useAccounts() {
  return useAppData().accounts;
}
export function useCategories() {
  return useAppData().categories;
}
export function useOutflowCategories() {
  return useAppData().outflowCategories;
}
export function useDestinatarios() {
  return useAppData().destinatarios;
}
export function useTagGroups() {
  return useAppData().tagGroups;
}
/** Profile currency; COP outside the provider (forms rendered before login). */
export function usePreferredCurrency(): CurrencyCode {
  return useContext(AppDataContext)?.preferredCurrency ?? "COP";
}
/** Active viaje/evento; null outside the provider or when none is active. */
export function useActiveModo(): ActiveModo | null {
  return useContext(AppDataContext)?.activeModo ?? null;
}
export function useAllTags(): Tag[] {
  const { tagGroups } = useAppData();
  return useMemo(() => tagGroups.flatMap((g) => g.tags), [tagGroups]);
}
