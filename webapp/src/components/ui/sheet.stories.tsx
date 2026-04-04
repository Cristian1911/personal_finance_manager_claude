import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";

const meta: Meta<typeof Sheet> = {
  title: "UI/Sheet",
  component: Sheet,
  tags: ["autodocs"],
  argTypes: {
    // side is on SheetContent, not Sheet
  },
};

export default meta;
type Story = StoryObj<typeof Sheet>;

export const Right: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Abrir panel derecho</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Filtrar transacciones</SheetTitle>
          <SheetDescription>
            Ajusta los filtros para encontrar lo que buscas.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 py-2 text-sm text-muted-foreground">
          Opciones de filtro aquí...
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline">Cancelar</Button>
          </SheetClose>
          <Button>Aplicar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

export const Left: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Menú</Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Navegación</SheetTitle>
        </SheetHeader>
        <nav className="px-4 space-y-2 text-sm">
          <p className="py-2 font-medium">Dashboard</p>
          <p className="py-2">Transacciones</p>
          <p className="py-2">Presupuesto</p>
          <p className="py-2">Cuentas</p>
        </nav>
      </SheetContent>
    </Sheet>
  ),
};

export const Bottom: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Panel inferior</Button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Acciones rápidas</SheetTitle>
        </SheetHeader>
        <div className="px-4 py-2 grid grid-cols-3 gap-2">
          <Button variant="outline" size="sm">Nuevo gasto</Button>
          <Button variant="outline" size="sm">Importar</Button>
          <Button variant="outline" size="sm">Ver reporte</Button>
        </div>
      </SheetContent>
    </Sheet>
  ),
};
