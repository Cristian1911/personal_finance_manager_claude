import type { Meta, StoryObj } from "@storybook/react";
import { Separator } from "./separator";

const meta: Meta<typeof Separator> = {
  title: "UI/Separator",
  component: Separator,
  tags: ["autodocs"],
  argTypes: {
    orientation: { control: "select", options: ["horizontal", "vertical"] },
  },
};

export default meta;
type Story = StoryObj<typeof Separator>;

export const Horizontal: Story = {
  render: () => (
    <div className="w-64 p-4 space-y-4">
      <p className="text-sm">Ingresos: $4,800,000</p>
      <Separator />
      <p className="text-sm">Gastos: $2,340,000</p>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-12 items-center gap-4 p-4">
      <span className="text-sm">Gastos</span>
      <Separator orientation="vertical" />
      <span className="text-sm">Ingresos</span>
      <Separator orientation="vertical" />
      <span className="text-sm">Ahorros</span>
    </div>
  ),
};
