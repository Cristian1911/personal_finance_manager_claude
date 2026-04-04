import type { Meta, StoryObj } from "@storybook/react";
import { Progress } from "./progress";

const meta: Meta<typeof Progress> = {
  title: "UI/Progress",
  component: Progress,
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
type Story = StoryObj<typeof Progress>;

export const Default: Story = { args: { value: 45 } };
export const Low: Story = { args: { value: 20 } };
export const Warning: Story = { args: { value: 80 } };
export const Over: Story = { args: { value: 110 } };
export const Zero: Story = { args: { value: 0 } };
export const Full: Story = { args: { value: 100 } };

export const AllStates: Story = {
  render: () => (
    <div className="space-y-4 w-64">
      <div>
        <p className="text-xs text-muted-foreground mb-1">20% — bajo uso</p>
        <Progress value={20} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">60% — normal</p>
        <Progress value={60} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">85% — advertencia</p>
        <Progress value={85} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">100% — completo</p>
        <Progress value={100} />
      </div>
    </div>
  ),
};
