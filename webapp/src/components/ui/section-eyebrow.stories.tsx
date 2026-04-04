import type { Meta, StoryObj } from "@storybook/react";
import { SectionEyebrow } from "./section-eyebrow";

const meta: Meta<typeof SectionEyebrow> = {
  title: "UI/SectionEyebrow",
  component: SectionEyebrow,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof SectionEyebrow>;

export const Default: Story = {
  args: { children: "Resumen del período" },
};

export const Budget: Story = {
  args: { children: "Presupuesto mensual" },
};

export const Transactions: Story = {
  args: { children: "Últimas transacciones" },
};

export const Accounts: Story = {
  args: { children: "Cuentas vinculadas" },
};
