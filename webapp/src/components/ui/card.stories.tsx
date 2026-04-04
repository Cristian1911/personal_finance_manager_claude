import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction } from "./card";

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-96 p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Resumen del mes</CardTitle>
        <CardDescription>Abril 2026</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">$4,800,000</p>
        <p className="text-sm text-muted-foreground">Ingresos totales</p>
      </CardContent>
    </Card>
  ),
};

export const WithAction: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Deuda activa</CardTitle>
        <CardDescription>2 créditos pendientes</CardDescription>
        <CardAction>
          <Button size="sm" variant="outline">Ver todo</Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-red-400">$12,500,000</p>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">Actualizado hace 2 min</p>
      </CardFooter>
    </Card>
  ),
};

export const Minimal: Story = {
  render: () => (
    <Card>
      <CardContent>
        <p className="text-sm">Contenido simple sin encabezado.</p>
      </CardContent>
    </Card>
  ),
};
