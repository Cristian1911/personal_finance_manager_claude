import type { Meta, StoryObj } from "@storybook/react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "./chart";

const chartData = [
  { mes: "Ene", gastos: 1800000 },
  { mes: "Feb", gastos: 2200000 },
  { mes: "Mar", gastos: 1950000 },
  { mes: "Abr", gastos: 2600000 },
  { mes: "May", gastos: 2100000 },
  { mes: "Jun", gastos: 1750000 },
];

const chartConfig: ChartConfig = {
  gastos: {
    label: "Gastos",
    color: "#7c6b3f",
  },
};

const meta: Meta<typeof ChartContainer> = {
  title: "UI/Chart",
  component: ChartContainer,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ChartContainer>;

export const Default: Story = {
  render: () => (
    <ChartContainer config={chartConfig} className="h-48 w-full max-w-md">
      <BarChart data={chartData}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="gastos" fill="var(--color-gastos)" radius={4} />
      </BarChart>
    </ChartContainer>
  ),
};
