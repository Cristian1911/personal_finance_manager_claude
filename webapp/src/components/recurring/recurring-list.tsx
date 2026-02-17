"use client";

import { useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  deleteRecurringTemplate,
  toggleRecurringTemplate,
} from "@/actions/recurring-templates";
import { formatCurrency } from "@/lib/utils/currency";
import { frequencyLabel } from "@/lib/utils/recurrence";
import { getNextOccurrence } from "@/lib/utils/recurrence";
import { formatDate } from "@/lib/utils/date";
import {
  ArrowDownLeft,
  ArrowUpRight,
  MoreVertical,
  Pause,
  Play,
  Pencil,
  Trash2,
} from "lucide-react";
import { RecurringFormDialog } from "./recurring-form-dialog";
import type {
  Account,
  CategoryWithChildren,
  CurrencyCode,
  RecurringTemplateWithRelations,
} from "@/types/domain";

export function RecurringList({
  templates,
  accounts,
  categories,
}: {
  templates: RecurringTemplateWithRelations[];
  accounts: Account[];
  categories: CategoryWithChildren[];
}) {
  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground mb-2">
          No tienes transacciones recurrentes configuradas.
        </p>
        <p className="text-sm text-muted-foreground">
          Crea una para rastrear pagos y cobros automáticos.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((template) => (
        <RecurringCard
          key={template.id}
          template={template}
          accounts={accounts}
          categories={categories}
        />
      ))}
    </div>
  );
}

function RecurringCard({
  template,
  accounts,
  categories,
}: {
  template: RecurringTemplateWithRelations;
  accounts: Account[];
  categories: CategoryWithChildren[];
}) {
  const [isPending, startTransition] = useTransition();

  const nextDate = getNextOccurrence(
    template.start_date,
    template.frequency,
    template.end_date
  );

  const handleToggle = () => {
    startTransition(() => {
      toggleRecurringTemplate(template.id, !template.is_active);
    });
  };

  const handleDelete = () => {
    startTransition(() => {
      deleteRecurringTemplate(template.id);
    });
  };

  return (
    <Card className={!template.is_active ? "opacity-60" : undefined}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {template.direction === "INFLOW" ? (
              <div className="p-2 rounded-lg bg-green-500/10">
                <ArrowDownLeft className="h-5 w-5 text-green-600" />
              </div>
            ) : (
              <div className="p-2 rounded-lg bg-orange-500/10">
                <ArrowUpRight className="h-5 w-5 text-orange-600" />
              </div>
            )}
            <div>
              <p className="font-medium">{template.merchant_name}</p>
              <p className="text-sm text-muted-foreground">
                {template.account.name}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isPending}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <RecurringFormDialog
                template={template}
                accounts={accounts}
                categories={categories}
                trigger={
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                }
              />
              <DropdownMenuItem onClick={handleToggle}>
                {template.is_active ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pausar
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Activar
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-4 flex items-baseline justify-between">
          <span
            className={`text-xl font-bold ${
              template.direction === "INFLOW" ? "text-green-600" : ""
            }`}
          >
            {template.direction === "INFLOW" ? "+" : "-"}
            {formatCurrency(template.amount, template.currency_code as CurrencyCode)}
          </span>
          <Badge variant="secondary">{frequencyLabel(template.frequency)}</Badge>
        </div>

        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          {template.category && (
            <span>
              {template.category.name_es || template.category.name}
            </span>
          )}
          {nextDate ? (
            <span>Próximo: {formatDate(nextDate)}</span>
          ) : (
            <span>Finalizado</span>
          )}
        </div>

        {!template.is_active && (
          <Badge variant="outline" className="mt-2">
            Pausada
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
