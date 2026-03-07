"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { SemanticColor } from "@/lib/utils/dashboard";

const colorMap: Record<SemanticColor, { stroke: string; fill: string }> = {
  positive: { stroke: "#10b981", fill: "#10b98120" },
  warning: { stroke: "#f59e0b", fill: "#f59e0b20" },
  danger: { stroke: "#ef4444", fill: "#ef444420" },
  neutral: { stroke: "#a1a1aa", fill: "#a1a1aa20" },
};

interface SparklineProps {
  data: { value: number }[];
  color?: SemanticColor;
  height?: number;
  width?: number;
}

export function Sparkline({ data, color = "neutral", height = 32, width = 96 }: SparklineProps) {
  if (data.length < 2) return null;

  const { stroke, fill } = colorMap[color];

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            fill={fill}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
