"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Info, CheckCircle2, Lightbulb } from "lucide-react";
import type { DebtInsight } from "@/lib/utils/debt";

const iconMap = {
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
};

const colorMap = {
  warning: {
    bg: "bg-amber-500/10",
    text: "text-amber-700",
    icon: "text-amber-500",
  },
  info: {
    bg: "bg-blue-500/10",
    text: "text-blue-700",
    icon: "text-blue-500",
  },
  success: {
    bg: "bg-green-500/10",
    text: "text-green-700",
    icon: "text-green-500",
  },
};

export function DebtInsights({ insights }: { insights: DebtInsight[] }) {
  if (insights.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((insight, i) => {
          const Icon = iconMap[insight.type];
          const colors = colorMap[insight.type];

          return (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-lg p-3 ${colors.bg}`}
            >
              <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${colors.icon}`} />
              <div>
                <p className={`text-sm font-medium ${colors.text}`}>
                  {insight.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {insight.description}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
