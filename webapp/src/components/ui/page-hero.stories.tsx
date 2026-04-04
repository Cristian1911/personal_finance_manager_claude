import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import { PageHero, HeroPill, HeroAccentPill } from "./page-hero";

const meta: Meta<typeof PageHero> = {
  title: "UI/PageHero",
  component: PageHero,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: ["sage", "brass"] },
  },
};

export default meta;
type Story = StoryObj<typeof PageHero>;

export const Sage: Story = {
  args: {
    variant: "sage",
    title: "¿Estás al día con tu presupuesto?",
    description:
      "Gestiona tu dinero con el método 50/30/20 y conoce en qué estás gastando cada peso.",
    pills: (
      <>
        <HeroPill>Presupuesto</HeroPill>
        <HeroAccentPill>Abril 2026</HeroAccentPill>
      </>
    ),
    actions: <Button>Ver detalle</Button>,
  },
};

export const Brass: Story = {
  args: {
    variant: "brass",
    title: "Planifica tu deuda",
    description:
      "Usa la estrategia bola de nieve o avalancha para salir de tus deudas más rápido.",
    pills: <HeroAccentPill>Deudas activas: 3</HeroAccentPill>,
  },
};

export const Minimal: Story = {
  args: {
    title: "Cuentas bancarias",
    description: "Conecta tus extractos para un seguimiento automático.",
  },
};
