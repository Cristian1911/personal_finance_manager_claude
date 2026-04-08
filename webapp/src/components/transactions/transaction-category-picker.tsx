"use client";

import { useState, useTransition } from "react";
import { categorizeTransaction, uncategorizeTransaction } from "@/actions/categorize";
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
import type { CategoryWithChildren, TransactionDirection } from "@/types/domain";

interface TransactionCategoryPickerProps {
  transactionId: string;
  currentCategoryId: string | null;
  categories: CategoryWithChildren[];
  direction?: TransactionDirection;
}

export function TransactionCategoryPicker({
  transactionId,
  currentCategoryId,
  categories,
  direction,
}: TransactionCategoryPickerProps) {
  const [value, setValue] = useState(currentCategoryId);
  const [, startTransition] = useTransition();

  function handleChange(categoryId: string | null) {
    setValue(categoryId);
    startTransition(async () => {
      if (categoryId) {
        await categorizeTransaction(transactionId, categoryId);
      } else {
        await uncategorizeTransaction(transactionId);
      }
    });
  }

  return (
    <CategoryZonePicker
      categories={categories}
      value={value}
      onValueChange={handleChange}
      direction={direction}
      variant="popover"
      triggerClassName="w-full h-9"
    />
  );
}
