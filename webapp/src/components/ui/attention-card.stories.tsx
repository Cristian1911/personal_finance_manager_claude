import type { Meta, StoryObj } from "@storybook/react";
import { AttentionCard } from "./attention-card";

const meta: Meta<typeof AttentionCard> = {
  title: "UI/AttentionCard",
  component: AttentionCard,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-96 rounded-2xl bg-z-surface p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AttentionCard>;

export const AllGood: Story = {
  args: { signals: [] },
};

export const WithSignals: Story = {
  args: {
    signals: [
      {
        key: "uncategorized",
        label: "Transacciones sin categorizar",
        count: 5,
        actionHref: "/transactions",
        page: "transactions" as const,
        priority: "action" as const,
      },
      {
        key: "budget-over",
        label: "Presupuestos excedidos",
        count: 2,
        actionHref: "/categories",
        page: "categories" as const,
        priority: "action" as const,
      },
    ],
  },
};

export const SingleSignal: Story = {
  args: {
    signals: [
      {
        key: "uncategorized",
        label: "Transacciones sin categorizar",
        count: 12,
        actionHref: "/transactions",
        page: "transactions" as const,
        priority: "action" as const,
      },
    ],
  },
};
