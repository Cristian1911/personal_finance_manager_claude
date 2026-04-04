import type { Meta, StoryObj } from "@storybook/react";
import { PrefetchLink } from "./prefetch-link";

const meta: Meta<typeof PrefetchLink> = {
  title: "UI/PrefetchLink",
  component: PrefetchLink,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof PrefetchLink>;

export const Default: Story = {
  render: () => (
    <PrefetchLink href="/dashboard" className="text-sm text-primary underline underline-offset-4">
      Ir al dashboard
    </PrefetchLink>
  ),
};

export const AsButton: Story = {
  render: () => (
    <PrefetchLink
      href="/transactions"
      className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
    >
      Ver transacciones
    </PrefetchLink>
  ),
};
