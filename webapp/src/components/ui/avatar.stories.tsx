import type { Meta, StoryObj } from "@storybook/react";
import { Avatar, AvatarFallback, AvatarImage, AvatarBadge, AvatarGroup, AvatarGroupCount } from "./avatar";

const meta: Meta<typeof Avatar> = {
  title: "UI/Avatar",
  component: Avatar,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "select", options: ["sm", "default", "lg"] },
  },
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const Default: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage src="https://github.com/shadcn.png" alt="Usuario" />
      <AvatarFallback>CG</AvatarFallback>
    </Avatar>
  ),
  args: { size: "default" },
};

export const Fallback: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarFallback>CG</AvatarFallback>
    </Avatar>
  ),
  args: { size: "default" },
};

export const Large: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarFallback>AB</AvatarFallback>
    </Avatar>
  ),
  args: { size: "lg" },
};

export const Small: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarFallback>XY</AvatarFallback>
    </Avatar>
  ),
  args: { size: "sm" },
};

export const WithBadge: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarFallback>CG</AvatarFallback>
      <AvatarBadge />
    </Avatar>
  ),
  args: { size: "default" },
};

export const Group: Story = {
  render: () => (
    <AvatarGroup>
      <Avatar>
        <AvatarFallback>CG</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>XY</AvatarFallback>
      </Avatar>
      <AvatarGroupCount>+3</AvatarGroupCount>
    </AvatarGroup>
  ),
};
