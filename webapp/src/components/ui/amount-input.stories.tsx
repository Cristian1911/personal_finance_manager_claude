import type { Meta, StoryObj } from "@storybook/react";
import { AmountInput } from "./amount-input";

const meta: Meta<typeof AmountInput> = {
  title: "UI/AmountInput",
  component: AmountInput,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="flex justify-center p-8">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AmountInput>;

export const Default: Story = {
  args: { currency: "COP" },
};

export const WithValue: Story = {
  args: { currency: "COP", value: 1500000 },
};

export const USD: Story = {
  args: { currency: "USD", value: 250 },
};

export const EUR: Story = {
  args: { currency: "EUR", defaultValue: 100 },
};
