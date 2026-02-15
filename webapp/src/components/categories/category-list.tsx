"use client";

import { Badge } from "@/components/ui/badge";
import type { CategoryWithChildren } from "@/types/domain";
import { ChevronRight, Lock } from "lucide-react";

export function CategoryList({
  categories,
}: {
  categories: CategoryWithChildren[];
}) {
  return (
    <div className="space-y-2">
      {categories.map((cat) => (
        <CategoryItem key={cat.id} category={cat} level={0} />
      ))}
    </div>
  );
}

function CategoryItem({
  category,
  level,
}: {
  category: CategoryWithChildren;
  level: number;
}) {
  return (
    <div>
      <div
        className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted transition-colors"
        style={{ paddingLeft: `${level * 24 + 12}px` }}
      >
        {category.children.length > 0 && (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <div
          className="h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: category.color }}
        />
        <span className="text-sm font-medium flex-1">
          {category.name_es || category.name}
        </span>
        <div className="flex items-center gap-2">
          {category.direction && (
            <Badge
              variant={category.direction === "INFLOW" ? "default" : "secondary"}
              className="text-xs"
            >
              {category.direction === "INFLOW" ? "Ingreso" : "Gasto"}
            </Badge>
          )}
          {category.is_essential && (
            <Badge variant="outline" className="text-xs">
              Esencial
            </Badge>
          )}
          {category.is_system && (
            <Lock className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      </div>
      {category.children.length > 0 && (
        <div>
          {category.children.map((child) => (
            <CategoryItem key={child.id} category={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
