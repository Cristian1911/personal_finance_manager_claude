"use server";

import { cache } from "react";
import { getMonthlyCashflow, getCategorySpending } from "@/actions/charts";
import type { CurrencyCode } from "@/types/domain";

export interface AllocationData {
  income: number;
  needs: { amount: number; percent: number; target: 50 };
  wants: { amount: number; percent: number; target: 30 };
  savings: { amount: number; percent: number; target: 20 };
  currency: CurrencyCode;
  untaggedCategories: number; // count of categories without expense_type set
}

export const get503020Allocation = cache(
  async (month?: string, currency: CurrencyCode = "COP"): Promise<AllocationData | null> => {
    // Fetch cashflow and category spending in parallel
    const [cashflows, categories] = await Promise.all([
      getMonthlyCashflow(month, currency),
      getCategorySpending(month, currency),
    ]);

    // Income = last element of cashflow array (current month)
    const income = cashflows.length > 0 ? cashflows[cashflows.length - 1].income : 0;

    if (income <= 0) {
      return null;
    }

    // Sum categories by expense_type
    let needsAmount = 0;
    let wantsAmount = 0;
    let untaggedCategories = 0;

    for (const cat of categories) {
      if (cat.expense_type === "fixed") {
        needsAmount += cat.amount;
      } else {
        // "variable" or null both go to Wants
        wantsAmount += cat.amount;
        if (cat.expense_type === null) {
          untaggedCategories += 1;
        }
      }
    }

    // Savings = income - needs - wants (can be negative if overspending)
    const savingsAmount = income - needsAmount - wantsAmount;

    return {
      income,
      needs: {
        amount: needsAmount,
        percent: (needsAmount / income) * 100,
        target: 50,
      },
      wants: {
        amount: wantsAmount,
        percent: (wantsAmount / income) * 100,
        target: 30,
      },
      savings: {
        amount: savingsAmount,
        percent: (savingsAmount / income) * 100,
        target: 20,
      },
      currency,
      untaggedCategories,
    };
  }
);
