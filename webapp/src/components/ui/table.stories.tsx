import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

const meta: Meta<typeof Table> = {
  title: "UI/Table",
  component: Table,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Table>;

const transactions = [
  { id: 1, desc: "Supermercado Éxito", category: "Alimentación", date: "01 abr", amount: "-$124,500" },
  { id: 2, desc: "Salario Empresa XYZ", category: "Ingresos", date: "01 abr", amount: "+$4,800,000" },
  { id: 3, desc: "Netflix", category: "Entretenimiento", date: "02 abr", amount: "-$17,900" },
  { id: 4, desc: "Gasolina", category: "Transporte", date: "03 abr", amount: "-$85,000" },
];

export const Default: Story = {
  render: () => (
    <Table>
      <TableCaption>Últimas transacciones de abril 2026</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Descripción</TableHead>
          <TableHead>Categoría</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead className="text-right">Monto</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((t) => (
          <TableRow key={t.id}>
            <TableCell className="font-medium">{t.desc}</TableCell>
            <TableCell>
              <Badge variant="outline">{t.category}</Badge>
            </TableCell>
            <TableCell>{t.date}</TableCell>
            <TableCell
              className={`text-right font-mono ${
                t.amount.startsWith("+") ? "text-green-400" : ""
              }`}
            >
              {t.amount}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Total neto</TableCell>
          <TableCell className="text-right font-mono">+$4,572,600</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  ),
};

export const Empty: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Descripción</TableHead>
          <TableHead>Monto</TableHead>
          <TableHead>Fecha</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
            No hay transacciones en este período.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};
