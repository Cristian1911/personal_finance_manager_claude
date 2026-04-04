import type { Meta, StoryObj } from "@storybook/react";
import { CreditCard, Settings, User } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "./command";

const meta: Meta<typeof Command> = {
  title: "UI/Command",
  component: Command,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-80 rounded-lg border shadow-md">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Command>;

export const Default: Story = {
  render: () => (
    <Command>
      <CommandInput placeholder="Buscar..." />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>
        <CommandGroup heading="Acciones">
          <CommandItem>
            <CreditCard className="size-4" />
            Nueva transacción
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <User className="size-4" />
            Ver perfil
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Configuración">
          <CommandItem>
            <Settings className="size-4" />
            Ajustes
            <CommandShortcut>⌘,</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};

export const Empty: Story = {
  render: () => (
    <Command>
      <CommandInput placeholder="Buscar categorías..." defaultValue="xyz" />
      <CommandList>
        <CommandEmpty>No se encontraron categorías.</CommandEmpty>
      </CommandList>
    </Command>
  ),
};
