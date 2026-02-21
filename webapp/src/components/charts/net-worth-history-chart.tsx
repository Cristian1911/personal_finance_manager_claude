"use client";

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
    type ChartConfig,
    ChartContainer,
    ChartTooltip,
} from "@/components/ui/chart";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import type { NetWorthHistory } from "@/actions/charts";

interface Props {
    data: NetWorthHistory[];
}

const chartConfig = {
    netWorth: {
        label: "Patrimonio Neto",
        color: "hsl(var(--primary))",
    },
} satisfies ChartConfig;

export function NetWorthHistoryChart({ data }: Props) {
    if (data.length < 2) {
        return null; // Not enough data to show a history chart appropriately, maybe we can still return something? Let's just return if it's completely empty.
    }

    const minBalance = Math.min(...data.map(d => d.netWorth));

    // Custom logic to add styling classes based on if it's positive or negative, but we'll stick to a primary color to match others for now.

    const formatYAxis = (v: number) => {
        if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
        if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
        return String(v);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Historial de Patrimonio Neto</CardTitle>
                <CardDescription>Evolución de tu patrimonio en los últimos 6 meses</CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full overflow-hidden">
                    <AreaChart data={data} accessibilityLayer margin={{ top: 10, left: -20, right: 12, bottom: 0 }}>
                        <defs>
                            <linearGradient id="fillNetWorth" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-netWorth)" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="var(--color-netWorth)" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={32}
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            domain={[minBalance > 0 ? 0 : 'dataMin', 'auto']}
                            tickFormatter={formatYAxis}
                        />
                        <ChartTooltip
                            content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0].payload as NetWorthHistory;
                                return (
                                    <div className="rounded-lg border bg-background p-2.5 shadow-sm text-xs">
                                        <p className="font-medium mb-1.5 text-muted-foreground">{d.label}</p>
                                        <div className="flex items-center gap-2">
                                            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--color-netWorth)" }} />
                                            <span className="font-medium">{formatCurrency(d.netWorth)}</span>
                                        </div>
                                    </div>
                                );
                            }}
                        />
                        <Area
                            dataKey="netWorth"
                            type="monotone"
                            fill="url(#fillNetWorth)"
                            fillOpacity={1}
                            stroke="var(--color-netWorth)"
                            strokeWidth={2}
                        />
                    </AreaChart>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}
