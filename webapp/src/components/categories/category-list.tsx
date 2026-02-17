"use client";

import { Badge } from "@/components/ui/badge";
import type { CategoryWithChildren } from "@/types/domain";
import { Lock } from "lucide-react";

export function CategoryList({
  categories,
}: {
  categories: CategoryWithChildren[];
}) {
  return (
    <div className="divide-y">
      {categories.map((cat) =>
        cat.children.length > 0 ? (
          <CategoryGroup key={cat.id} group={cat} />
        ) : (
          <CategoryLeaf key={cat.id} category={cat} />
        )
      )}
    </div>
  );
}

function CategoryGroup({ group }: { group: CategoryWithChildren }) {
  return (
    <div>
      {/* Group header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/40">
        <div
          className="h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: group.color }}
        />
        <span className="text-sm font-semibold flex-1">
          {group.name_es || group.name}
        </span>
        {group.is_system && (
          <Lock className="h-3 w-3 text-muted-foreground" />
        )}
      </div>
      {/* Children */}
      <div>
        {group.children.map((child) => (
          <CategoryLeaf key={child.id} category={child} indent />
        ))}
      </div>
    </div>
  );
}

function CategoryLeaf({
  category,
  indent,
}: {
  category: CategoryWithChildren;
  indent?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors"
      style={indent ? { paddingLeft: "2.5rem" } : undefined}
    >
      <div
        className="h-2.5 w-2.5 rounded-full shrink-0"
        style={{ backgroundColor: category.color }}
      />
      <span className="text-sm flex-1">
        {category.name_es || category.name}
      </span>
      <div className="flex items-center gap-2">
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
  );
}
