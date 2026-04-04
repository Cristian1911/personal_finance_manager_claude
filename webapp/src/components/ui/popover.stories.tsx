import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
  PopoverTrigger,
} from "./popover";

const meta: Meta<typeof Popover> = {
  title: "UI/Popover",
  component: Popover,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Popover>;

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Abrir popover</Button>
      </PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>Información del período</PopoverTitle>
          <PopoverDescription>
            Mostrando datos de abril 2026.
          </PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  ),
};

export const WithActions: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button>Detalles</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-2">
          <p className="font-medium text-sm">Resumen de gastos</p>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Alimentación: $450,000</p>
            <p>Transporte: $120,000</p>
            <p>Ocio: $230,000</p>
          </div>
          <Button size="sm" className="w-full mt-2">Ver todo</Button>
        </div>
      </PopoverContent>
    </Popover>
  ),
};
