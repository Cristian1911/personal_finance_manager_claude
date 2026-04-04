import type { Meta, StoryObj } from "@storybook/react";
import { Plus, Download } from "lucide-react";
import { Button } from "./button";
import { PageHeaderRow } from "./page-header-row";

const meta: Meta<typeof PageHeaderRow> = {
  title: "UI/PageHeaderRow",
  component: PageHeaderRow,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="p-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PageHeaderRow>;

export const Default: Story = {
  args: {
    title: "Transacciones",
    subtitle: "Abril 2026",
  },
};

export const WithActions: Story = {
  args: {
    title: "Presupuesto",
    subtitle: "Gestiona tu asignación 50/30/20",
    actions: (
      <>
        <Button variant="outline" size="sm">
          <Download className="size-4" />
          Exportar
        </Button>
        <Button size="sm">
          <Plus className="size-4" />
          Nueva categoría
        </Button>
      </>
    ),
  },
};

export const TitleOnly: Story = {
  args: {
    title: "Cuentas bancarias",
  },
};

export const LongTitle: Story = {
  args: {
    title: "Historial de transacciones importadas",
    subtitle: "Extractos procesados desde enero 2026",
  },
};
