import type { Meta, StoryObj } from "@storybook/react";
import { AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

const meta: Meta<typeof ToggleGroup> = {
  title: "UI/ToggleGroup",
  component: ToggleGroup,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: ["default", "outline"] },
    size: { control: "select", options: ["sm", "default", "lg"] },
    type: { control: "select", options: ["single", "multiple"] },
  },
};

export default meta;
type Story = StoryObj<typeof ToggleGroup>;

export const Default: Story = {
  render: () => (
    <ToggleGroup type="single" defaultValue="mes">
      <ToggleGroupItem value="semana">Semana</ToggleGroupItem>
      <ToggleGroupItem value="mes">Mes</ToggleGroupItem>
      <ToggleGroupItem value="año">Año</ToggleGroupItem>
    </ToggleGroup>
  ),
};

export const Outline: Story = {
  render: () => (
    <ToggleGroup type="single" variant="outline" defaultValue="gastos">
      <ToggleGroupItem value="gastos">Gastos</ToggleGroupItem>
      <ToggleGroupItem value="ingresos">Ingresos</ToggleGroupItem>
      <ToggleGroupItem value="todo">Todo</ToggleGroupItem>
    </ToggleGroup>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <ToggleGroup type="single" variant="outline" defaultValue="left">
      <ToggleGroupItem value="left" aria-label="Izquierda">
        <AlignLeft className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="center" aria-label="Centro">
        <AlignCenter className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="right" aria-label="Derecha">
        <AlignRight className="size-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
};

export const Multiple: Story = {
  render: () => (
    <ToggleGroup type="multiple" variant="outline" defaultValue={["bancolombia"]}>
      <ToggleGroupItem value="bancolombia">Bancolombia</ToggleGroupItem>
      <ToggleGroupItem value="davivienda">Davivienda</ToggleGroupItem>
      <ToggleGroupItem value="nequi">Nequi</ToggleGroupItem>
    </ToggleGroup>
  ),
};
