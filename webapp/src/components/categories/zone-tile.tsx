"use client";

import { cn } from "@/lib/utils";
import { zoneBackground, zoneBorder, zoneTextColor } from "@/lib/utils/zone-colors";
import { CategoryIcon } from "./category-icon";
import { SubcategoryChip } from "./subcategory-chip";
import type { CategoryWithChildren } from "@/types/domain";

interface ZoneTileProps {
  category: CategoryWithChildren;
  onClick?: () => void;
  isExpanded?: boolean;
  showChips?: boolean;
  headerActions?: React.ReactNode;
  className?: string;
}

export function ZoneTile({
  category,
  onClick,
  isExpanded,
  showChips = true,
  headerActions,
  className,
}: ZoneTileProps) {
  const color = category.color;
  const name = category.name_es ?? category.name;
  const Component = onClick ? "button" : "div";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-xl p-3 text-left transition-all w-full",
        onClick && "cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
        isExpanded && "ring-2",
        className
      )}
      style={{
        backgroundColor: zoneBackground(color),
        borderWidth: "1px",
        borderColor: zoneBorder(color),
        ...(isExpanded ? { ringColor: color } : {}),
      }}
    >
      {/* Two 160px columns inside a 320px popover truncated 7 of 12 zone names
          to "Transpo…", "Obligaci…", "Entreteni…". Wrap to two lines instead. */}
      <div className="flex items-start gap-2 mb-2">
        <CategoryIcon icon={category.icon} className="shrink-0 text-lg" />
        <span
          // 13px + break-words: fits "Transporte"/"Educación" on one line and
          // only splits a word when it genuinely cannot fit, instead of the
          // mid-word "Transport/e" that `anywhere` produced.
          className="min-w-0 flex-1 text-[13px] font-semibold leading-tight break-words line-clamp-2"
          style={{ color: zoneTextColor(color) }}
        >
          {name}
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {category.children.length}
        </span>
        {headerActions}
      </div>

      {showChips && category.children.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {category.children.map((child) => (
            <SubcategoryChip
              key={child.id}
              name={child.name_es ?? child.name}
              icon={child.icon ?? undefined}
              color={color}
            />
          ))}
        </div>
      )}
    </Component>
  );
}
