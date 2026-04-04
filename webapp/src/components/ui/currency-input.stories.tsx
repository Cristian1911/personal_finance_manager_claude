import type { Meta, StoryObj } from "@storybook/react";
import { CurrencyInput } from "./currency-input";

const meta: Meta<typeof CurrencyInput> = {
  title: "UI/CurrencyInput",
  component: CurrencyInput,
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
type Story = StoryObj<typeof CurrencyInput>;

export const Default: Story = {
  args: { placeholder: "0" },
};

export const WithValue: Story = {
  args: { value: 1500000 },
};

export const WithDefaultValue: Story = {
  args: { defaultValue: 450000 },
};

export const Disabled: Story = {
  args: { value: 800000, disabled: true },
};

export const WithPlaceholder: Story = {
  args: { placeholder: "Ingrese el monto..." },
};
