import type { Meta, StoryObj } from "@storybook/react";
import { toast } from "sonner";
import { Button } from "./button";
import { Toaster } from "./sonner";

const meta: Meta<typeof Toaster> = {
  title: "UI/Toaster",
  component: Toaster,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="flex flex-col gap-2 p-4">
        <Toaster />
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Toaster>;

export const Default: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        onClick={() => toast("Cambios guardados correctamente.")}
      >
        Toast normal
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.success("Importación exitosa — 42 transacciones.")}
      >
        Éxito
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.error("Error al procesar el extracto.")}
      >
        Error
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.warning("Presupuesto a punto de agotarse.")}
      >
        Advertencia
      </Button>
      <Button
        variant="outline"
        onClick={() => toast.info("3 transacciones sin categorizar.")}
      >
        Info
      </Button>
    </div>
  ),
};
