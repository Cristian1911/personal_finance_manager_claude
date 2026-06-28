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
  Merge,
  Repeat,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { RecurringFormDialog } from "./recurring-form-dialog";
import { RecurringImpactDialog } from "./recurring-impact-dialog";
import { SubPaymentsBreakdown } from "./sub-payments-breakdown";
import { MergePickerSheet } from "./merge-picker-sheet";
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
      <EmptyState
        icon={<Repeat className="size-6" strokeWidth={1.5} />}
        title="Registra lo que se repite"
        description="Suscripciones, arriendo, cuotas — Zeta te avisa antes de cada cobro."
        primary={{ label: "Agregar recurrente", href: "/recurrentes/new", icon: Plus }}
        footer={
          <Link
            href="/suscripciones"
            className="text-xs font-semibold text-z-brass transition-colors hover:text-z-brass-hot"
          >
            Ver suscripciones detectadas
          </Link>
        }
      />
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
  const [mergeOpen, setMergeOpen] = useState(false);
  // "Abono a deuda" = an INFLOW that reduces the debt (paid via transfer).
  // An OUTFLOW on a debt account is a recurring charge, not an abono.
  const isDebtPayment =
    (template.account.account_type === "CREDIT_CARD" ||
      template.account.account_type === "LOAN") &&
    template.direction === "INFLOW";
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
              <DropdownMenuItem onClick={() => { setMenuOpen(false); setMergeOpen(true); }}>
                <Merge className="h-4 w-4 mr-2" />
                Combinar con otra
              </DropdownMenuItem>
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

        <MergePickerSheet
          open={mergeOpen}
          onOpenChange={setMergeOpen}
          sourceTemplate={template}
          onMerged={() => { /* revalidateFinancialViews() in action expires cache tags */ }}
        />
      </CardContent>
    </Card>
  );
}
