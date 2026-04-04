import type { Meta, StoryObj } from "@storybook/react";
import { CompactMetricBox, StatCard } from "./stat-card";

const compactMeta: Meta<typeof CompactMetricBox> = {
  title: "UI/CompactMetricBox",
  component: CompactMetricBox,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-48 p-4">
        <Story />
      </div>
    ),
  ],
};

export default compactMeta;
type CompactStory = StoryObj<typeof CompactMetricBox>;

export const Default: CompactStory = {
  args: {
    label: "Presupuesto",
    value: "$2,400,000",
    context: "4 fuentes",
  },
};

export const Expense: CompactStory = {
  args: {
    label: "Gastos del mes",
    value: <span className="text-red-400">$1,847,200</span>,
    context: "21% del ingreso",
  },
};

export const NoContext: CompactStory = {
  args: {
    label: "Saldo disponible",
    value: "$1,200,000",
  },
};

export const StatCardDefault: StoryObj<typeof StatCard> = {
  render: () => (
    <div className="w-48 p-4">
      <StatCard
        label="Total deudas"
        value="$12,500,000"
        description="2 créditos activos"
      />
    </div>
  ),
};
