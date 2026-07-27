import type { Meta, StoryObj } from "@storybook/react";
import { EntityRow, type EntityRowProps } from "./entity-row";

const meta: Meta<typeof EntityRow> = {
  title: "UI/EntityRow",
  component: EntityRow,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof EntityRow>;

const Badge = ({ children }: { children: string }) => (
  <span className="flex size-9 items-center justify-center rounded-lg bg-z-brass/20 text-xs font-bold text-z-brass">
    {children}
  </span>
);

const ahorro: EntityRowProps = {
  leading: <Badge>B</Badge>,
  title: "Bancolombia Ahorros ****4398",
  meta: ["sin actualizar 20d"],
  trailing: { value: "$ 180.296", caption: "disponible", tone: "neutral" },
};

const tarjeta: EntityRowProps = {
  leading: <Badge>B</Badge>,
  title: "Bancolombia VISA ****7022",
  gauge: { pct: 105, label: "uso", tone: "alert" },
  meta: ["cuota $ 2.024.211", "28.8% EA"],
  trailing: { value: "$ 5.665.822", caption: "usado", tone: "debt" },
};

const prestamo: EntityRowProps = {
  leading: <Badge>B</Badge>,
  title: "Bancolombia Préstamo ****2475",
  gauge: { pct: 67, label: "pagado", tone: "income" },
  meta: ["cuota $ 159.477", "10.3% EA"],
  trailing: { value: "$ 330.339", caption: "saldo", tone: "debt" },
};

export const Ahorro: Story = { args: ahorro };
export const TarjetaExcedida: Story = { args: tarjeta };
export const Prestamo: Story = { args: prestamo };

export const Expandible: Story = {
  args: {
    ...prestamo,
    children: (
      <div className="rounded-lg border border-white/6 bg-black/20 p-3 text-sm text-muted-foreground">
        Aquí van las celdas de detalle y las acciones de la pantalla.
      </div>
    ),
  },
};

/** Las tres formas juntas — así se ve la densidad real de /accounts. */
export const Lista: Story = {
  render: () => (
    <div className="max-w-sm space-y-2">
      <EntityRow {...ahorro} />
      <EntityRow {...tarjeta} />
      <EntityRow {...prestamo} />
    </div>
  ),
};
