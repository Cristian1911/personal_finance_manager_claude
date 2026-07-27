"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type {
  Account,
  CategoryWithChildren,
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
export function useAllTags(): Tag[] {
  const { tagGroups } = useAppData();
  return useMemo(() => tagGroups.flatMap((g) => g.tags), [tagGroups]);
}
