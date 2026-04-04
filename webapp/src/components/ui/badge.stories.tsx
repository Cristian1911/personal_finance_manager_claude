import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./badge";

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "destructive", "outline", "ghost", "link"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = { args: { children: "Activo" } };
export const Secondary: Story = { args: { variant: "secondary", children: "Pendiente" } };
export const Destructive: Story = { args: { variant: "destructive", children: "Vencido" } };
export const Outline: Story = { args: { variant: "outline", children: "Borrador" } };
export const Ghost: Story = { args: { variant: "ghost", children: "Archivado" } };

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>Activo</Badge>
      <Badge variant="secondary">Pendiente</Badge>
      <Badge variant="destructive">Vencido</Badge>
      <Badge variant="outline">Borrador</Badge>
      <Badge variant="ghost">Archivado</Badge>
    </div>
  ),
};
