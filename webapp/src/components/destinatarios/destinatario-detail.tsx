"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Trash2,
  Plus,
  X,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  updateDestinatario,
  deleteDestinatario,
  addDestinatarioRule,
  removeDestinatarioRule,
  testDestinatarioPattern,
} from "@/actions/destinatarios";
import type {
  DestinatarioWithRules,
  TransactionPreview,
  PatternTestResult,
} from "@/actions/destinatarios";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { ActionResult } from "@/types/actions";
import type { Database } from "@/types/database";
import type { CategoryWithChildren, CurrencyCode } from "@/types/domain";

type Destinatario = Database["public"]["Tables"]["destinatarios"]["Row"];
type DestinatarioRuleRow =
  Database["public"]["Tables"]["destinatario_rules"]["Row"];

interface DestinatarioDetailProps {
  destinatario: DestinatarioWithRules;
  categories: CategoryWithChildren[];
  categoryMap: Record<string, string>;
  transactions: TransactionPreview[];
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function DestinatarioDetail({
  destinatario,
  categories,
  categoryMap,
  transactions,
}: DestinatarioDetailProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left column: Edit form + Rules */}
      <div className="lg:col-span-2 space-y-6">
        <EditForm
          destinatario={destinatario}
          categories={categories}
          categoryMap={categoryMap}
        />
        <RulesSection
          destinatarioId={destinatario.id}
          rules={destinatario.rules}
        />
      </div>

      {/* Right column: Recent transactions + Delete */}
      <div className="space-y-6">
        <RecentTransactions
          destinatarioId={destinatario.id}
          transactions={transactions}
        />
        <DeleteSection
          destinatarioId={destinatario.id}
          destinatarioName={destinatario.name}
        />
      </div>
    </div>
  );
}

// ─── Edit Form ──────────────────────────────────────────────────────────────

function EditForm({
  destinatario,
  categories,
  categoryMap,
}: {
  destinatario: DestinatarioWithRules;
  categories: CategoryWithChildren[];
  categoryMap: Record<string, string>;
}) {
  const [isActive, setIsActive] = useState(destinatario.is_active);

  const boundUpdate = updateDestinatario.bind(null, destinatario.id);

  const [state, formAction, pending] = useActionState<
    ActionResult<Destinatario>,
    FormData
  >(
    async (prevState, formData) => {
      // Radix Select sends "none" — normalize to empty so server treats as null
      if (formData.get("default_category_id") === "none") {
        formData.set("default_category_id", "");
      }
      const result = await boundUpdate(prevState, formData);
      if (result.success) toast.success("Destinatario actualizado");
      else toast.error(result.error);
      return result;
    },
    { success: false, error: "" }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos del destinatario</CardTitle>
        <CardDescription>
          Nombre, categoría por defecto y estado
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {!state.success && state.error && (
            <div className="bg-destructive/10 text-destructive text-sm rounded-md p-3">
              {state.error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              name="name"
              defaultValue={destinatario.name}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="default_category_id">Categoría por defecto</Label>
            <Select
              name="default_category_id"
              defaultValue={destinatario.default_category_id ?? "none"}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin categoría</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id} disabled={cat.children.length > 0}>
                    {cat.name_es ?? cat.name}
                  </SelectItem>
                ))}
                {categories.flatMap((cat) =>
                  cat.children.map((child) => (
                    <SelectItem key={child.id} value={child.id}>
                      &nbsp;&nbsp;{child.name_es ?? child.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {destinatario.default_category_id &&
              categoryMap[destinatario.default_category_id] && (
                <p className="text-xs text-muted-foreground">
                  Actual:{" "}
                  <Badge variant="secondary" className="text-xs">
                    {categoryMap[destinatario.default_category_id]}
                  </Badge>
                </p>
              )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Input
              id="notes"
              name="notes"
              defaultValue={destinatario.notes ?? ""}
              placeholder="Notas opcionales..."
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="is_active">Activo</Label>
              <p className="text-xs text-muted-foreground">
                Los destinatarios inactivos no se usan para categorizar
              </p>
            </div>
            <Switch
              id="is_active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
          <input
            type="hidden"
            name="is_active"
            value={isActive ? "true" : "false"}
          />

          <Button type="submit" disabled={pending}>
            {pending ? "Guardando..." : "Guardar cambios"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Rules Section ──────────────────────────────────────────────────────────

function RulesSection({
  destinatarioId,
  rules,
}: {
  destinatarioId: string;
  rules: DestinatarioRuleRow[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [testResult, setTestResult] = useState<PatternTestResult | null>(null);
  const [testing, setTesting] = useState(false);

  const boundAddRule = addDestinatarioRule.bind(null, destinatarioId);

  const [addState, addFormAction, addPending] = useActionState<
    ActionResult<DestinatarioRuleRow>,
    FormData
  >(
    async (prevState, formData) => {
      const result = await boundAddRule(prevState, formData);
      if (result.success) {
        toast.success("Regla agregada");
        setTestResult(null);
      } else {
        toast.error(result.error);
      }
      return result;
    },
    { success: false, error: "" }
  );

  async function handleTestPattern() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    const pattern = fd.get("pattern") as string | null;
    const matchType = (fd.get("match_type") as "contains" | "exact") ?? "contains";
    if (!pattern || pattern.length < 2) return;
    setTesting(true);
    setTestResult(null);
    const result = await testDestinatarioPattern(pattern, matchType);
    if (result.success) setTestResult(result.data);
    setTesting(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reglas de coincidencia</CardTitle>
        <CardDescription>
          Patrones que asocian transacciones a este destinatario
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing rules */}
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin reglas. Agrega un patrón para asociar transacciones
            automáticamente.
          </p>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => (
              <RuleItem key={rule.id} rule={rule} />
            ))}
          </div>
        )}

        {/* Add rule form */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-3">Agregar regla</p>
          {!addState.success && addState.error && (
            <div className="bg-destructive/10 text-destructive text-sm rounded-md p-3 mb-3">
              {addState.error}
            </div>
          )}
          <form ref={formRef} action={addFormAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="pattern" className="text-xs">
                Patrón
              </Label>
              <Input
                id="pattern"
                name="pattern"
                placeholder="Ej: NEQUI, RAPPI..."
                required
                minLength={2}
              />
            </div>
            <div className="w-full sm:w-[140px] space-y-1">
              <Label htmlFor="match_type" className="text-xs">
                Tipo
              </Label>
              <Select name="match_type" defaultValue="contains">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Contiene</SelectItem>
                  <SelectItem value="exact">Exacto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" type="button" onClick={handleTestPattern} disabled={testing}>
                {testing ? "Probando..." : "Probar"}
              </Button>
              <Button type="submit" size="sm" disabled={addPending}>
                <Plus className="size-4 mr-1" />
                {addPending ? "Agregando..." : "Agregar"}
              </Button>
            </div>
          </form>
          {testResult && (
            <div className="rounded-md bg-z-surface-2 p-3 text-xs space-y-1 mt-3">
              <p className={testResult.matchCount > 0 ? "text-z-income font-medium" : "text-muted-foreground"}>
                {testResult.matchCount} transacciones coinciden
              </p>
              {testResult.samples.length > 0 && (
                <ul className="space-y-0.5 text-muted-foreground">
                  {testResult.samples.map((s) => (
                    <li key={s.id}>{s.rawDescription} · {formatCurrency(s.amount)}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RuleItem({ rule }: { rule: DestinatarioRuleRow }) {
  const [removing, startTransition] = useTransition();

  const matchCount = rule.match_count ?? 0;
  const lastMatchedAt = rule.last_matched_at;

  function handleRemove() {
    startTransition(async () => {
      const result = await removeDestinatarioRule(rule.id);
      if (result.success) toast.success("Regla eliminada");
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-2">
          <code className="text-sm font-mono truncate">{rule.pattern}</code>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {rule.match_type === "exact" ? "Exacto" : "Contiene"}
          </Badge>
          {matchCount === 0 && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">Sin uso</Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {matchCount > 0 ? `Usada ${matchCount} veces` : "Sin uso"}
          {lastMatchedAt && ` · ${formatDate(lastMatchedAt)}`}
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={handleRemove}
        disabled={removing}
      >
        <X className="size-3.5" />
        <span className="sr-only">Eliminar regla</span>
      </Button>
    </div>
  );
}

// ─── Recent Transactions ────────────────────────────────────────────────────

function RecentTransactions({
  destinatarioId,
  transactions,
}: {
  destinatarioId: string;
  transactions: TransactionPreview[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Transacciones recientes</CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay transacciones asociadas a este destinatario.
          </p>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-start justify-between gap-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">
                    {tx.clean_description ?? tx.raw_description ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(tx.transaction_date)}
                    {tx.category_name && (
                      <>
                        {" "}
                        · {tx.category_icon} {tx.category_name}
                      </>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tx.account_name}
                  </p>
                </div>
                <span
                  className={`shrink-0 font-medium tabular-nums ${
                    tx.direction === "INFLOW"
                      ? "text-z-income"
                      : "text-foreground"
                  }`}
                >
                  {tx.direction === "INFLOW" ? "+" : "-"}
                  {formatCurrency(tx.amount, tx.currency_code as CurrencyCode)}
                </span>
              </div>
            ))}

            <Link
              href={`/transacciones?destinatario=${destinatarioId}`}
              className="flex items-center gap-1 text-sm text-primary hover:underline pt-2"
            >
              Ver todas
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Delete Section ─────────────────────────────────────────────────────────

function DeleteSection({
  destinatarioId,
  destinatarioName,
}: {
  destinatarioId: string;
  destinatarioName: string;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteDestinatario(destinatarioId);
    setDeleting(false);

    if (result.success) {
      setOpen(false);
      toast.success("Destinatario eliminado");
      router.push("/destinatarios");
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-base text-destructive">
          Zona peligrosa
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Eliminar este destinatario desvinculará sus transacciones (no se
          eliminarán).
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="size-4 mr-2" />
              Eliminar destinatario
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Eliminar destinatario</DialogTitle>
              <DialogDescription>
                ¿Eliminar &quot;{destinatarioName}&quot;? Las transacciones
                asociadas no se eliminarán, solo se desvincularán.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Eliminando..." : "Eliminar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
