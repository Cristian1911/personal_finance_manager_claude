import type { Meta, StoryObj } from "@storybook/react";
import { Calendar } from "./calendar";

const meta: Meta<typeof Calendar> = {
  title: "UI/Calendar",
  component: Calendar,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="flex justify-center p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Calendar>;

export const Default: Story = {
  args: {
    mode: "single",
    selected: new Date("2026-04-01"),
  },
};

export const Range: Story = {
  args: {
    mode: "range",
    selected: {
      from: new Date("2026-04-01"),
      to: new Date("2026-04-15"),
    },
  },
};

export const WithDropdown: Story = {
  args: {
    mode: "single",
    captionLayout: "dropdown",
    selected: new Date(),
  },
};

export const NoOutsideDays: Story = {
  args: {
    mode: "single",
    showOutsideDays: false,
    selected: new Date(),
  },
};
