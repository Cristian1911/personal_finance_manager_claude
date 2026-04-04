import type { Meta, StoryObj } from "@storybook/react";
import { Label } from "./label";
import { Input } from "./input";
import { Checkbox } from "./checkbox";

const meta: Meta<typeof Label> = {
  title: "UI/Label",
  component: Label,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Label>;

export const Default: Story = {
  args: { children: "Categoría" },
};

export const WithInput: Story = {
  render: () => (
    <div className="grid gap-2">
      <Label htmlFor="email">Correo electrónico</Label>
      <Input id="email" type="email" placeholder="tu@correo.com" />
    </div>
  ),
};

export const WithCheckbox: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="include" />
      <Label htmlFor="include">Incluir transacciones pendientes</Label>
    </div>
  ),
};
