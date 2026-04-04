import type { Meta, StoryObj } from "@storybook/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const meta: Meta<typeof Tabs> = {
  title: "UI/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="gastos">
      <TabsList>
        <TabsTrigger value="gastos">Gastos</TabsTrigger>
        <TabsTrigger value="ingresos">Ingresos</TabsTrigger>
        <TabsTrigger value="ahorro">Ahorro</TabsTrigger>
      </TabsList>
      <TabsContent value="gastos">
        <p className="text-sm text-muted-foreground mt-2">Mostrando gastos del período...</p>
      </TabsContent>
      <TabsContent value="ingresos">
        <p className="text-sm text-muted-foreground mt-2">Mostrando ingresos del período...</p>
      </TabsContent>
      <TabsContent value="ahorro">
        <p className="text-sm text-muted-foreground mt-2">Mostrando ahorro del período...</p>
      </TabsContent>
    </Tabs>
  ),
};

export const LineVariant: Story = {
  render: () => (
    <Tabs defaultValue="mes">
      <TabsList variant="line">
        <TabsTrigger value="semana">Semana</TabsTrigger>
        <TabsTrigger value="mes">Mes</TabsTrigger>
        <TabsTrigger value="año">Año</TabsTrigger>
      </TabsList>
      <TabsContent value="semana">
        <p className="text-sm text-muted-foreground mt-2">Semana actual</p>
      </TabsContent>
      <TabsContent value="mes">
        <p className="text-sm text-muted-foreground mt-2">Mes actual: Abril 2026</p>
      </TabsContent>
      <TabsContent value="año">
        <p className="text-sm text-muted-foreground mt-2">Año actual: 2026</p>
      </TabsContent>
    </Tabs>
  ),
};

export const Vertical: Story = {
  render: () => (
    <Tabs defaultValue="general" orientation="vertical" className="max-w-sm">
      <TabsList>
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="cuentas">Cuentas</TabsTrigger>
        <TabsTrigger value="seguridad">Seguridad</TabsTrigger>
      </TabsList>
      <TabsContent value="general">
        <p className="text-sm text-muted-foreground">Configuración general</p>
      </TabsContent>
      <TabsContent value="cuentas">
        <p className="text-sm text-muted-foreground">Gestión de cuentas</p>
      </TabsContent>
      <TabsContent value="seguridad">
        <p className="text-sm text-muted-foreground">Contraseña y sesiones</p>
      </TabsContent>
    </Tabs>
  ),
};
