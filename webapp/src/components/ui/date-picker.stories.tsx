import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { DatePicker } from "./date-picker";

const meta: Meta<typeof DatePicker> = {
  title: "UI/DatePicker",
  component: DatePicker,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="p-8">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DatePicker>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState<string | null>(null);
    return <DatePicker value={value} onChange={setValue} />;
  },
};

export const WithValue: Story = {
  render: () => {
    const [value, setValue] = useState<string | null>("2026-04-01");
    return <DatePicker value={value} onChange={setValue} />;
  },
};

export const Disabled: Story = {
  render: () => (
    <DatePicker value="2026-04-01" onChange={() => {}} disabled />
  ),
};

export const CustomPlaceholder: Story = {
  render: () => {
    const [value, setValue] = useState<string | null>(null);
    return (
      <DatePicker
        value={value}
        onChange={setValue}
        placeholder="Fecha de pago"
      />
    );
  },
};
