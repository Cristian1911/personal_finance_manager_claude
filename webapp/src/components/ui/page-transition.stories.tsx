import type { Meta, StoryObj } from "@storybook/react";
import { PageTransition } from "./page-transition";

const meta: Meta<typeof PageTransition> = {
  title: "UI/PageTransition",
  component: PageTransition,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof PageTransition>;

export const Default: Story = {
  render: () => (
    <PageTransition>
      <div className="rounded-lg border p-6">
        <p className="text-sm text-muted-foreground">
          Este contenido entra con animación cuando la página carga.
        </p>
      </div>
    </PageTransition>
  ),
};
