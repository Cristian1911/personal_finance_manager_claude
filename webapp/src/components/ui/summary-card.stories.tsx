import type { Meta, StoryObj } from "@storybook/react";
import { SummaryCard } from "./summary-card";

const meta: Meta<typeof SummaryCard> = {
  title: "UI/SummaryCard",
  component: SummaryCard,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-full max-w-2xl p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SummaryCard>;

export const Default: Story = {
  args: {
    label: "Resumen del período",
    metrics: [
      { label: "Ingresos", value: "$4,800,000", context: "3 fuentes" },
      { label: "Gastos", value: "$2,340,000", context: "48% del ingreso" },
      { label: "Ahorro", value: "$2,460,000", context: "Meta: $3,000,000" },
    ],
  },
};

export const BudgetSummary: Story = {
  args: {
    label: "Presupuesto 50/30/20",
    metrics: [
      { label: "Necesidades", value: "$2,400,000", context: "50% — en meta" },
      { label: "Gustos", value: "$1,440,000", context: "30% — en meta" },
      { label: "Ahorro", value: "$960,000", context: "20% — en meta" },
    ],
  },
};

export const OverBudget: Story = {
  args: {
    label: "Estado actual",
    metrics: [
      { label: "Necesidades", value: "$2,900,000", context: "60% — excedido" },
      { label: "Gustos", value: "$800,000", context: "16% — bajo" },
      { label: "Ahorro", value: "$1,100,000", context: "22% — en meta" },
    ],
  },
};
