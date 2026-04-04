import type { Meta, StoryObj } from "@storybook/react";
import { TrendingUp, TrendingDown, CreditCard, Wallet } from "lucide-react";
import { KPIWidget } from "./kpi-widget";

const meta: Meta<typeof KPIWidget> = {
  title: "UI/KPIWidget",
  component: KPIWidget,
  tags: ["autodocs"],
  argTypes: {
    semanticColor: {
      control: "select",
      options: ["income", "expense", "debt", "alert", "neutral"],
    },
  },
  decorators: [
    (Story) => (
      <div className="w-64 p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof KPIWidget>;

export const Income: Story = {
  args: {
    label: "Ingresos del mes",
    value: "$4,800,000",
    semanticColor: "income",
    icon: <Wallet className="size-5" />,
    trend: { direction: "up", text: "+12% vs mes anterior" },
  },
};

export const Expense: Story = {
  args: {
    label: "Gastos totales",
    value: "$2,340,000",
    semanticColor: "expense",
    icon: <CreditCard className="size-5" />,
    trend: { direction: "down", text: "-5% vs mes anterior" },
  },
};

export const Debt: Story = {
  args: {
    label: "Deuda activa",
    value: "$12,500,000",
    semanticColor: "debt",
    icon: <TrendingDown className="size-5" />,
    trend: { direction: "down", text: "Pagando $450,000/mes" },
  },
};

export const Alert: Story = {
  args: {
    label: "Presupuesto excedido",
    value: "3 categorías",
    semanticColor: "alert",
    trend: { direction: "up", text: "Revisar urgente" },
  },
};

export const NoTrend: Story = {
  args: {
    label: "Saldo total",
    value: "$8,200,000",
    semanticColor: "neutral",
    icon: <TrendingUp className="size-5" />,
  },
};
