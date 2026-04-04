import type { Meta, StoryObj } from "@storybook/react";
import { useForm } from "react-hook-form";
import { Input } from "./input";
import { Button } from "./button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./form";

const meta: Meta = {
  title: "UI/Form",
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const form = useForm<{ nombre: string; monto: string }>({
      defaultValues: { nombre: "", monto: "" },
    });

    return (
      <div className="w-80 p-4">
        <Form {...form}>
          <form className="space-y-4">
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Mercado semanal" {...field} />
                  </FormControl>
                  <FormDescription>
                    Nombre que verás en el historial.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="monto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto</FormLabel>
                  <FormControl>
                    <Input placeholder="0" type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full">
              Guardar transacción
            </Button>
          </form>
        </Form>
      </div>
    );
  },
};
