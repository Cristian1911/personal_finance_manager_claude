import type { Meta, StoryObj } from "@storybook/react";
import { Save, Plus } from "lucide-react";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
    },
    size: {
      control: "select",
      options: ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-lg"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = { args: { children: "Guardar" } };
export const Destructive: Story = { args: { variant: "destructive", children: "Eliminar" } };
export const Outline: Story = { args: { variant: "outline", children: "Cancelar" } };
export const Secondary: Story = { args: { variant: "secondary", children: "Ver más" } };
export const Ghost: Story = { args: { variant: "ghost", children: "Más opciones" } };
export const Link: Story = { args: { variant: "link", children: "Ver detalle" } };

export const WithIcon: Story = {
  args: { children: <><Save className="size-4" /> Guardar cambios</> },
};

export const IconOnly: Story = {
  args: { variant: "outline", size: "icon", children: <Plus className="size-4" /> },
};

export const Disabled: Story = {
  args: { children: "No disponible", disabled: true },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="xs">Extra pequeño</Button>
      <Button size="sm">Pequeño</Button>
      <Button size="default">Normal</Button>
      <Button size="lg">Grande</Button>
    </div>
  ),
};
