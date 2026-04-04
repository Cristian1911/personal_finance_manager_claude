import type { Meta, StoryObj } from "@storybook/react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "./collapsible";
import { Button } from "./button";

const meta: Meta<typeof Collapsible> = {
  title: "UI/Collapsible",
  component: Collapsible,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-80 p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Collapsible>;

export const Default: Story = {
  render: () => (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between">
          Gastos del mes
          <ChevronDown className="size-4" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-1 text-sm text-muted-foreground">
        <p>Alimentación: $450,000</p>
        <p>Transporte: $120,000</p>
        <p>Ocio: $230,000</p>
      </CollapsibleContent>
    </Collapsible>
  ),
};

export const OpenByDefault: Story = {
  render: () => (
    <Collapsible defaultOpen>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between">
          Ver categorías
          <ChevronDown className="size-4" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-1 text-sm text-muted-foreground">
        <p>Vivienda: $1,200,000</p>
        <p>Salud: $80,000</p>
        <p>Educación: $300,000</p>
      </CollapsibleContent>
    </Collapsible>
  ),
};
