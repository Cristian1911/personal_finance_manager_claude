import type { Meta, StoryObj } from "@storybook/react";
import { Tag, UserRound, Plus, X } from "lucide-react";
import { Chip } from "./chip";

const meta: Meta<typeof Chip> = {
  title: "UI/Chip",
  component: Chip,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["neutral", "active", "primary", "danger"],
    },
    size: {
      control: "select",
      options: ["sm", "md"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Chip>;

export const Neutral: Story = { args: { children: "Categoría" } };
export const Active: Story = { args: { variant: "active", children: "Mantenimiento" } };
export const Primary: Story = { args: { variant: "primary", children: "Categorizar" } };
export const Danger: Story = { args: { variant: "danger", children: "Quitar" } };

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2 bg-z-ink p-4">
      <Chip variant="neutral">
        <Tag /> Categoría
      </Chip>
      <Chip variant="active">
        <UserRound /> Hermanita
      </Chip>
      <Chip variant="primary">
        <Plus /> Categorizar
      </Chip>
      <Chip variant="danger">
        <X /> Quitar
      </Chip>
    </div>
  ),
};

export const AsButton: Story = {
  render: () => (
    <Chip asChild variant="active">
      <button type="button">
        <UserRound /> Tocá para editar
      </button>
    </Chip>
  ),
};
