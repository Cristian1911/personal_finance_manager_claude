import type { Meta, StoryObj } from "@storybook/react";
import { Verdict } from "./verdict";

const meta: Meta<typeof Verdict> = {
  title: "UI/Verdict",
  component: Verdict,
  tags: ["autodocs"],
  argTypes: {
    state: {
      control: "select",
      options: ["vas-bien", "cerca", "te-pasaste", "atencion"],
    },
    compact: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Verdict>;

export const VasBien: Story = { args: { state: "vas-bien" } };
export const Cerca: Story = { args: { state: "cerca" } };
export const TePasaste: Story = { args: { state: "te-pasaste" } };
export const Atencion: Story = { args: { state: "atencion" } };

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2 bg-z-ink p-4">
      <Verdict state="vas-bien" />
      <Verdict state="cerca" />
      <Verdict state="te-pasaste" />
      <Verdict state="atencion" />
    </div>
  ),
};

export const WithDelta: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2 bg-z-ink p-4">
      <Verdict state="vas-bien" delta="79% del plan" />
      <Verdict state="cerca" delta="91%" />
      <Verdict state="te-pasaste" delta="−$486.000" />
      <Verdict state="atencion" delta="3 por resolver" />
    </div>
  ),
};

export const WithDetail: Story = {
  render: () => (
    <div className="flex flex-col gap-4 bg-z-ink p-4">
      <Verdict
        state="te-pasaste"
        delta="−$486.000"
        detail="Llevas $486.000 sobre el plan; Transporte pesa más de la mitad."
      />
      <Verdict
        state="vas-bien"
        delta="24% del ingreso"
        detail="Tus cuotas de este mes caben dentro de tu ingreso."
      />
    </div>
  ),
};

export const CompactRows: Story = {
  render: () => (
    <div className="flex flex-col gap-2 bg-z-ink p-4">
      {(
        [
          { name: "Mercado", state: "vas-bien", amount: "$310.000" },
          { name: "Transporte", state: "cerca", amount: "$228.000" },
          { name: "Restaurantes", state: "te-pasaste", amount: "$381.000" },
          { name: "Sin categoría", state: "atencion", amount: "$92.000" },
        ] as const
      ).map((row) => (
        <div
          key={row.name}
          className="flex items-center justify-between rounded-lg border border-white/6 px-3 py-2.5"
        >
          <span className="text-[13px] font-medium text-white">{row.name}</span>
          <div className="flex items-center gap-3">
            <Verdict state={row.state} compact />
            <span className="text-[13px] tabular-nums text-z-sage-light">
              {row.amount}
            </span>
          </div>
        </div>
      ))}
    </div>
  ),
};
