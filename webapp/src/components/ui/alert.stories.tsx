import type { Meta, StoryObj } from "@storybook/react";
import { AlertCircle, Info, CheckCircle2, AlertTriangle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "./alert";

const meta: Meta<typeof Alert> = {
  title: "UI/Alert",
  component: Alert,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const Default: Story = {
  render: (args) => (
    <Alert {...args}>
      <Info className="size-4" />
      <AlertTitle>Información</AlertTitle>
      <AlertDescription>
        Tu saldo ha sido actualizado correctamente.
      </AlertDescription>
    </Alert>
  ),
  args: { variant: "default" },
};

export const Destructive: Story = {
  render: (args) => (
    <Alert {...args}>
      <AlertCircle className="size-4" />
      <AlertTitle>Error al importar</AlertTitle>
      <AlertDescription>
        No se pudo procesar el extracto. Verifica que el archivo sea válido.
      </AlertDescription>
    </Alert>
  ),
  args: { variant: "destructive" },
};

export const WithoutIcon: Story = {
  render: (args) => (
    <Alert {...args}>
      <AlertTitle>Presupuesto excedido</AlertTitle>
      <AlertDescription>
        Has gastado más del 80% de tu presupuesto de ocio este mes.
      </AlertDescription>
    </Alert>
  ),
  args: { variant: "default" },
};

export const Success: Story = {
  render: (args) => (
    <Alert {...args}>
      <CheckCircle2 className="size-4" />
      <AlertTitle>Importación exitosa</AlertTitle>
      <AlertDescription>
        Se importaron 42 transacciones sin errores.
      </AlertDescription>
    </Alert>
  ),
  args: { variant: "default" },
};

export const Warning: Story = {
  render: (args) => (
    <Alert {...args}>
      <AlertTriangle className="size-4" />
      <AlertTitle>Revisa tus gastos</AlertTitle>
      <AlertDescription>
        3 transacciones están sin categorizar este mes.
      </AlertDescription>
    </Alert>
  ),
  args: { variant: "default" },
};
