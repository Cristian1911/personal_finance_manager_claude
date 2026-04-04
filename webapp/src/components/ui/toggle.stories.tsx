import type { Meta, StoryObj } from "@storybook/react";
import { Bold, Italic, Underline } from "lucide-react";
import { Toggle } from "./toggle";

const meta: Meta<typeof Toggle> = {
  title: "UI/Toggle",
  component: Toggle,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: ["default", "outline"] },
    size: { control: "select", options: ["sm", "default", "lg"] },
  },
};

export default meta;
type Story = StoryObj<typeof Toggle>;

export const Default: Story = {
  args: { children: "Activo", "aria-label": "Alternar" },
};

export const Outline: Story = {
  args: { variant: "outline", children: "Filtro", "aria-label": "Alternar filtro" },
};

export const WithIcon: Story = {
  args: {
    variant: "outline",
    "aria-label": "Negrita",
    children: <Bold className="size-4" />,
  },
};

export const Pressed: Story = {
  args: {
    defaultPressed: true,
    children: "Seleccionado",
    "aria-label": "Alternar selección",
  },
};

export const Disabled: Story = {
  args: { disabled: true, children: "Deshabilitado", "aria-label": "Deshabilitado" },
};

export const FormattingGroup: Story = {
  render: () => (
    <div className="flex gap-1">
      <Toggle aria-label="Negrita" variant="outline">
        <Bold className="size-4" />
      </Toggle>
      <Toggle aria-label="Cursiva" variant="outline">
        <Italic className="size-4" />
      </Toggle>
      <Toggle aria-label="Subrayado" variant="outline">
        <Underline className="size-4" />
      </Toggle>
    </div>
  ),
};
