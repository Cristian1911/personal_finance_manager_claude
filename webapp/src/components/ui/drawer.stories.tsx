import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "./drawer";

const meta: Meta<typeof Drawer> = {
  title: "UI/Drawer",
  component: Drawer,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Drawer>;

export const Default: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline">Abrir panel</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Nueva transacción</DrawerTitle>
          <DrawerDescription>
            Registra un gasto o ingreso manualmente.
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 py-2 text-sm text-muted-foreground">
          Formulario de transacción aquí...
        </div>
        <DrawerFooter>
          <Button>Guardar</Button>
          <DrawerClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
};

export const WithActions: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button>Filtros</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Filtrar transacciones</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 space-y-3">
          <p className="text-sm">Período: Abril 2026</p>
          <p className="text-sm">Categoría: Todas</p>
          <p className="text-sm">Monto: Cualquiera</p>
        </div>
        <DrawerFooter>
          <Button>Aplicar filtros</Button>
          <DrawerClose asChild>
            <Button variant="ghost">Limpiar</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
};
