import type { Meta, StoryObj } from "@storybook/react";
import { Search } from "lucide-react";
import { Input } from "./input";

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-64 p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { placeholder: "Buscar transacciones..." },
};

export const WithValue: Story = {
  args: { defaultValue: "Supermercado Éxito" },
};

export const Disabled: Story = {
  args: { placeholder: "No editable", disabled: true },
};

export const Password: Story = {
  args: { type: "password", placeholder: "Contraseña" },
};

export const Number: Story = {
  args: { type: "number", placeholder: "Monto en COP" },
};

export const Invalid: Story = {
  args: {
    defaultValue: "valor-inválido",
    "aria-invalid": true,
  } as React.ComponentProps<typeof Input>,
};

export const WithIcon: Story = {
  render: () => (
    <div className="relative w-64">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input className="pl-9" placeholder="Buscar..." />
    </div>
  ),
};
