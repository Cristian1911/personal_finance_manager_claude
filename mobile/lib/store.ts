import { create } from "zustand";
import type { Account, Transaction, Category, Profile } from "@venti5/shared";

type AppState = {
  profile: Profile | null;
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  setProfile: (profile: Profile | null) => void;
  setAccounts: (accounts: Account[]) => void;
  setTransactions: (transactions: Transaction[]) => void;
  setCategories: (categories: Category[]) => void;
  clear: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  profile: null,
  accounts: [],
  transactions: [],
  categories: [],
  setProfile: (profile) => set({ profile }),
  setAccounts: (accounts) => set({ accounts }),
  setTransactions: (transactions) => set({ transactions }),
  setCategories: (categories) => set({ categories }),
  clear: () =>
    set({ profile: null, accounts: [], transactions: [], categories: [] }),
}));
