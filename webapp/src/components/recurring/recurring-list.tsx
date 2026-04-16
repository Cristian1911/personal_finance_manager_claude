"use client";

import { useState, useTransition } from "react";
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
import { frequencyLabel, getNextOccurrence } from "@zeta/shared";
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
import { RecurringImpactDialog } from "./recurring-impact-dialog";
import { SubPaymentsBreakdown } from "./sub-payments-breakdown";
import type {
  Account,
  CategoryWithChildren,
  CurrencyCode,
  SubPayment,
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
  const [menuOpen, setMenuOpen] = useState(false);
  const isDebtPayment =
    template.account.account_type === "CREDIT_CARD" ||
    template.account.account_type === "LOAN";
  const isIncome = template.direction === "INFLOW" && !isDebtPayment;

  const nextDate = getNextOccurrence(
    template.start_date,
    template.frequency,
    template.end_date
  );

  const handleActivate = () => {
    startTransition(() => {
      toggleRecurringTemplate(template.id, true);
    });
  };

  const handlePauseConfirm = async () => {
    setMenuOpen(false);
    await toggleRecurringTemplate(template.id, false);
  };

  const handleDeleteConfirm = async () => {
    setMenuOpen(false);
    await deleteRecurringTemplate(template.id);
  };

  return (
    <Card className={!template.is_active ? "opacity-60" : undefined}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {isIncome ? (
              <div className="p-2 rounded-lg bg-z-income/10">
                <ArrowDownLeft className="h-5 w-5 text-z-income" />
              </div>
            ) : (
              <div className="p-2 rounded-lg bg-z-expense/10">
                <ArrowUpRight className="h-5 w-5 text-z-expense" />
              </div>
            )}
            <div>
              <p className="font-medium">{template.merchant_name}</p>
              <p className="text-sm text-muted-foreground">
                {template.account.name}
              </p>
            </div>
          </div>

          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
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
              {template.is_active ? (
                <RecurringImpactDialog
                  templateId={template.id}
                  templateName={template.merchant_name ?? "Recurrente"}
                  currencyCode={(template.currency_code ?? "COP") as CurrencyCode}
                  action="pause"
                  onConfirm={handlePauseConfirm}
                  trigger={
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <Pause className="h-4 w-4 mr-2" />
                      Pausar
                    </DropdownMenuItem>
                  }
                />
              ) : (
                <DropdownMenuItem onClick={handleActivate}>
                  <Play className="h-4 w-4 mr-2" />
                  Activar
                </DropdownMenuItem>
              )}
              <RecurringImpactDialog
                templateId={template.id}
                templateName={template.merchant_name ?? "Recurrente"}
                currencyCode={(template.currency_code ?? "COP") as CurrencyCode}
                action="delete"
                onConfirm={handleDeleteConfirm}
                trigger={
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar
                  </DropdownMenuItem>
                }
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-4 flex items-baseline justify-between">
          <div>
            <span
              className={`text-xl font-bold tabular-nums ${
                template.direction === "INFLOW" ? "text-z-income" : ""
              }`}
            >
              {isIncome ? "+" : "-"}
              {formatCurrency(template.amount, template.currency_code as CurrencyCode)}
            </span>
            {Array.isArray(template.sub_payments) && (template.sub_payments as unknown as SubPayment[]).length > 1 && (
              <SubPaymentsBreakdown
                subPayments={template.sub_payments as unknown as SubPayment[]}
                className="mt-0.5 flex gap-2 text-xs"
              />
            )}
          </div>
          <Badge variant="secondary">{frequencyLabel(template.frequency)}</Badge>
        </div>

        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          {template.category && (
            <span>
              {isDebtPayment
                ? "Abono de deuda (transferencia)"
                : template.category.name_es || template.category.name}
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
