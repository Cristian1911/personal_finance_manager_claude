import { Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WishlistInsight } from "@/actions/wishlist";

type DeseosInsightsProps = {
  insights: WishlistInsight[];
};

export function DeseosInsights({ insights }: DeseosInsightsProps) {
  if (insights.length === 0) return null;

  return (
    <Card className="border-white/6 bg-z-surface-2/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Lightbulb className="size-4 text-z-brass" />
          Tu patrón de compras
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((insight, i) => (
          <div
            key={i}
            className="rounded-lg bg-white/3 p-3"
          >
            <p className="text-sm font-medium">{insight.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {insight.message}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
