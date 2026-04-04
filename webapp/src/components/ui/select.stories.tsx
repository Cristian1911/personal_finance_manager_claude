import type { Meta, StoryObj } from "@storybook/react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./select";

const meta: Meta<typeof Select> = {
  title: "UI/Select",
  component: Select,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Seleccionar cuenta" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="bancolombia">Bancolombia</SelectItem>
        <SelectItem value="davivienda">Davivienda</SelectItem>
        <SelectItem value="nequi">Nequi</SelectItem>
        <SelectItem value="nu">Nu</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const WithGroups: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Seleccionar categoría" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Necesidades</SelectLabel>
          <SelectItem value="vivienda">Vivienda</SelectItem>
          <SelectItem value="alimentacion">Alimentación</SelectItem>
          <SelectItem value="salud">Salud</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Gustos</SelectLabel>
          <SelectItem value="ocio">Ocio</SelectItem>
          <SelectItem value="restaurantes">Restaurantes</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};

export const WithValue: Story = {
  render: () => (
    <Select defaultValue="nequi">
      <SelectTrigger className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="bancolombia">Bancolombia</SelectItem>
        <SelectItem value="davivienda">Davivienda</SelectItem>
        <SelectItem value="nequi">Nequi</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const Small: Story = {
  render: () => (
    <Select>
      <SelectTrigger size="sm" className="w-40">
        <SelectValue placeholder="Período" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="este-mes">Este mes</SelectItem>
        <SelectItem value="mes-anterior">Mes anterior</SelectItem>
        <SelectItem value="3-meses">Últimos 3 meses</SelectItem>
      </SelectContent>
    </Select>
  ),
};
