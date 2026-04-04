import type { Meta, StoryObj } from "@storybook/react";
import { Switch } from "./switch";
import { Label } from "./label";

const meta: Meta<typeof Switch> = {
  title: "UI/Switch",
  component: Switch,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "select", options: ["sm", "default"] },
  },
};

export default meta;
type Story = StoryObj<typeof Switch>;

export const Default: Story = {};

export const Checked: Story = {
  args: { defaultChecked: true },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const DisabledChecked: Story = {
  args: { disabled: true, defaultChecked: true },
};

export const Small: Story = {
  args: { size: "sm" },
};

export const WithLabel: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Switch id="notifs" defaultChecked />
      <Label htmlFor="notifs">Notificaciones activas</Label>
    </div>
  ),
};

export const WithLabelRight: Story = {
  render: () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label htmlFor="dark-mode">Modo oscuro</Label>
        <Switch id="dark-mode" />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="auto-cat">Auto-categorización</Label>
        <Switch id="auto-cat" defaultChecked />
      </div>
    </div>
  ),
};
