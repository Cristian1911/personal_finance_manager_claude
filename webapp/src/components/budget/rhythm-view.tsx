import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";
import type { RhythmGroup } from "@/actions/categories";

interface RhythmViewProps {
  groups: RhythmGroup[];
  currency: CurrencyCode;
}

export function RhythmView({ groups, currency }: RhythmViewProps) {
  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No hay categorías asignadas a grupos de ritmo aún.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const totalSpent = group.categories.reduce((sum, c) => sum + (c.spent ?? 0), 0);
        const totalBudget = group.categories.reduce((sum, c) => sum + (c.budget ?? 0), 0);

        return (
          <div key={group.rhythmTag} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold" style={{ color: group.color }}>
                {group.rhythmTag}
              </h3>
              <span className="text-sm text-muted-foreground">
                {formatCurrency(totalSpent, currency)}
                {totalBudget > 0 && (
                  <> / {formatCurrency(totalBudget, currency)}</>
                )}
              </span>
            </div>

            <div className="space-y-1">
              {group.categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between rounded-lg px-3 py-1.5 hover:bg-white/5"
                >
                  <span className="text-sm">{cat.name_es ?? cat.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(cat.spent ?? 0, currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
