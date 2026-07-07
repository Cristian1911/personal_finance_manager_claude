"use client";

import { useActionState, useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Trash2,
  Plus,
  X,
  ArrowRight,
  Search,
  Loader2,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import {
  updateDestinatario,
  deleteDestinatario,
  addDestinatarioRule,
  removeDestinatarioRule,
  testDestinatarioPattern,
  findUnlinkedMatches,
  bulkLinkToDestinatario,
  previewDestinatarioRuleImpact,
  applyDestinatarioRules,
} from "@/actions/destinatarios";
import type {
  DestinatarioWithRules,
  TransactionPreview,
  PatternTestResult,
  UnlinkedMatch,
} from "@/actions/destinatarios";
import { Checkbox } from "@/components/ui/checkbox";
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
import { TagPicker } from "@/components/tags/tag-picker";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { ActionResult } from "@/types/actions";
import type { Database } from "@/types/database";
import type { CategoryWithChildren, CurrencyCode, Tag, TagGroupWithTags } from "@/types/domain";

type Destinatario = Database["public"]["Tables"]["destinatarios"]["Row"];
type DestinatarioRuleRow =
  Database["public"]["Tables"]["destinatario_rules"]["Row"];

interface DestinatarioDetailProps {
  destinatario: DestinatarioWithRules;
  categories: CategoryWithChildren[];
  categoryMap: Record<string, string>;
  transactions: TransactionPreview[];
  tagGroups: TagGroupWithTags[];
  destinatarioTags: Tag[];
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function DestinatarioDetail({
  destinatario,
  categories,
  categoryMap,
  transactions,
  tagGroups,
  destinatarioTags,
}: DestinatarioDetailProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left column: Edit form + Tags + Rules */}
      <div className="lg:col-span-2 space-y-6">
        <EditForm
          destinatario={destinatario}
          categories={categories}
          categoryMap={categoryMap}
        />

        {/* Tags card */}
        <Card>
          <CardHeader>
            <CardTitle>Etiquetas</CardTitle>
            <CardDescription>
              Agrega etiquetas para organizar y filtrar este destinatario
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TagPicker
              entityType="destinatario"
              entityId={destinatario.id}
              currentTags={destinatarioTags}
              allTagGroups={tagGroups}
            />
          </CardContent>
        </Card>

        <RulesSection
          destinatarioId={destinatario.id}
          destinatarioName={destinatario.name}
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
  const [kind, setKind] = useState<"merchant" | "person">(destinatario.kind ?? "merchant");
  const [categoryId, setCategoryId] = useState<string | null>(
    destinatario.default_category_id,
  );
  // Legacy data: some destinatarios still carry a zone (parent category) as
  // default. The zone picker can't select parents, so surface it explicitly
  // and let the user pick a real subcategory to fix it.
  const assignedParent = categories.find(
    (c) => c.id === categoryId && c.children.length > 0,
  );
  const [ruleImpact, setRuleImpact] = useState<{ matchCount: number } | null>(null);
  const [applyingRules, startApplyTransition] = useTransition();

  const boundUpdate = updateDestinatario.bind(null, destinatario.id);

  const handleApplyRules = () => {
    startApplyTransition(async () => {
      const applyResult = await applyDestinatarioRules(destinatario.id);
      setRuleImpact(null);
      if (applyResult.success) {
        const { linked, categorized } = applyResult.data;
        toast.success(
          `${linked} transacciones vinculadas${categorized > 0 ? `, ${categorized} categorizadas` : ""}`
        );
      } else {
        toast.error(applyResult.error);
      }
    });
  };

  const [state, formAction, pending] = useActionState<
    ActionResult<Destinatario>,
    FormData
  >(
    async (prevState, formData) => {
      const result = await boundUpdate(prevState, formData);
      if (result.success) {
        toast.success("Destinatario actualizado");
        const preview = await previewDestinatarioRuleImpact(destinatario.id);
        if (preview.success && preview.data.matchCount > 0) {
          setRuleImpact({ matchCount: preview.data.matchCount });
        }
      } else {
        toast.error(result.error);
      }
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
            <Label>Categoría por defecto</Label>
            <CategoryZonePicker
              categories={categories}
              value={categoryId}
              onValueChange={setCategoryId}
              variant="popover"
              placeholder="Sin categoría"
              triggerClassName="w-full"
            />
            {/* A legacy zone value would be rejected by the server — submit
                empty instead so saving other fields keeps working; the user
                either picks a subcategory or the zone gets cleared. */}
            <input
              type="hidden"
              name="default_category_id"
              value={assignedParent ? "" : categoryId ?? ""}
            />
            {assignedParent && (
              <p className="text-xs text-z-alert">
                La categoría actual (
                <Badge variant="secondary" className="text-xs">
                  {categoryMap[assignedParent.id] ??
                    assignedParent.name_es ??
                    assignedParent.name}
                </Badge>
                ) es una zona general y ya no es válida. Elige una subcategoría
                específica — si guardas sin elegir una, quedará sin categoría.
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

          <div className="space-y-2" role="radiogroup" aria-labelledby="dest-detail-tipo-label">
            <Label id="dest-detail-tipo-label">Tipo</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                role="radio"
                aria-checked={kind === "merchant"}
                onClick={() => setKind("merchant")}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  kind === "merchant"
                    ? "border-z-brass/40 bg-z-brass/10"
                    : "border-white/6 bg-z-surface-2",
                )}
              >
                Comercio
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={kind === "person"}
                onClick={() => setKind("person")}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  kind === "person"
                    ? "border-z-brass/40 bg-z-brass/10"
                    : "border-white/6 bg-z-surface-2",
                )}
              >
                Persona
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Las personas aparecen en cuentas personales; los comercios se usan para categorizar.
            </p>
          </div>
          <input type="hidden" name="kind" value={kind} />

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

          <Button type="submit" className={BRASS_BUTTON_CLASS} disabled={pending}>
            {pending ? "Guardando..." : "Guardar cambios"}
          </Button>
        </form>
      </CardContent>

      <AlertDialog open={!!ruleImpact} onOpenChange={(open) => !open && setRuleImpact(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vincular transacciones</AlertDialogTitle>
            <AlertDialogDescription>
              Esta regla aplica a {ruleImpact?.matchCount ?? 0} transacciones sin destinatario. ¿Vincular automáticamente?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={GHOST_BUTTON_CLASS}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className={BRASS_BUTTON_CLASS}
              onClick={handleApplyRules}
              disabled={applyingRules}
            >
              {applyingRules ? "Vinculando..." : "Vincular"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ─── Rules Section ──────────────────────────────────────────────────────────

function RulesSection({
  destinatarioId,
  destinatarioName,
  rules,
}: {
  destinatarioId: string;
  destinatarioName: string;
  rules: DestinatarioRuleRow[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [testResult, setTestResult] = useState<PatternTestResult | null>(null);
  const [testing, setTesting] = useState(false);

  // Find & link state
  const [unlinkedMatches, setUnlinkedMatches] = useState<UnlinkedMatch[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [linking, startLinkTransition] = useTransition();

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
        formRef.current?.reset();
        router.refresh();
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

  async function handleSearchUnlinked() {
    setSearching(true);
    setUnlinkedMatches(null);
    setSelectedTxIds(new Set());
    const result = await findUnlinkedMatches(destinatarioId);
    if (result.success) {
      setUnlinkedMatches(result.data);
      // Pre-select all
      setSelectedTxIds(new Set(result.data.map((m) => m.id)));
    } else {
      toast.error(result.error);
    }
    setSearching(false);
  }

  const toggleTx = useCallback((id: string) => {
    setSelectedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  function handleToggleAll() {
    if (!unlinkedMatches) return;
    if (selectedTxIds.size === unlinkedMatches.length) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(unlinkedMatches.map((m) => m.id)));
    }
  }

  function handleLinkSelected() {
    if (selectedTxIds.size === 0) return;
    startLinkTransition(async () => {
      const result = await bulkLinkToDestinatario(
        destinatarioId,
        Array.from(selectedTxIds)
      );
      if (result.success) {
        const { linked, categorized } = result.data;
        let msg = `${linked} ${linked === 1 ? "transacción vinculada" : "transacciones vinculadas"}`;
        if (categorized > 0) {
          msg += ` · ${categorized} categorizada${categorized !== 1 ? "s" : ""}`;
        }
        toast.success(msg);
        setUnlinkedMatches(null);
        setSelectedTxIds(new Set());
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Reglas de coincidencia</CardTitle>
            <CardDescription>
              Patrones que asocian transacciones a este destinatario
            </CardDescription>
          </div>
          {rules.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className={cn(GHOST_BUTTON_CLASS, "gap-1.5")}
              onClick={handleSearchUnlinked}
              disabled={searching}
            >
              {searching ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Search className="size-3.5" />
              )}
              Buscar transacciones
            </Button>
          )}
        </div>
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
              <RuleItem key={rule.id} rule={rule} onRemoved={() => router.refresh()} />
            ))}
          </div>
        )}

        {/* Find & link unmatched transactions */}
        {unlinkedMatches !== null && (
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                Transacciones sin vincular
                {unlinkedMatches.length > 0 && (
                  <span className="ml-1.5 text-muted-foreground font-normal">
                    ({unlinkedMatches.length} encontrada{unlinkedMatches.length !== 1 ? "s" : ""})
                  </span>
                )}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setUnlinkedMatches(null); setSelectedTxIds(new Set()); }}
              >
                Cerrar
              </Button>
            </div>

            {unlinkedMatches.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No se encontraron transacciones sin vincular que coincidan con las reglas de &quot;{destinatarioName}&quot;.
              </p>
            ) : (
              <>
                {/* Select all + action bar */}
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={selectedTxIds.size === unlinkedMatches.length}
                      onCheckedChange={handleToggleAll}
                    />
                    {selectedTxIds.size === unlinkedMatches.length
                      ? "Deseleccionar todas"
                      : "Seleccionar todas"}
                  </label>
                  <Button
                    size="sm"
                    className={cn(BRASS_BUTTON_CLASS, "h-7 gap-1.5 text-xs")}
                    onClick={handleLinkSelected}
                    disabled={linking || selectedTxIds.size === 0}
                  >
                    {linking ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Link2 className="size-3" />
                    )}
                    Vincular {selectedTxIds.size}
                  </Button>
                </div>

                {/* Transaction list */}
                <div className="max-h-[320px] overflow-y-auto space-y-1 rounded-lg border p-2">
                  {unlinkedMatches.map((tx) => (
                    <label
                      key={tx.id}
                      className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent/50 transition-colors"
                    >
                      <Checkbox
                        checked={selectedTxIds.has(tx.id)}
                        onCheckedChange={() => toggleTx(tx.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs">
                          {tx.clean_description ?? tx.raw_description}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatDate(tx.transaction_date)} · {tx.account_name}
                          {!tx.category_id && (
                            <span className="ml-1 text-z-alert">· Sin categoría</span>
                          )}
                        </p>
                      </div>
                      <span className={`shrink-0 text-xs font-mono tabular-nums ${
                        tx.direction === "OUTFLOW" ? "" : "text-z-income"
                      }`}>
                        {tx.direction === "OUTFLOW" ? "-" : "+"}
                        {formatCurrency(tx.amount, tx.currency_code as CurrencyCode)}
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}
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
              <Button
                variant="outline"
                size="sm"
                type="button"
                className={GHOST_BUTTON_CLASS}
                onClick={handleTestPattern}
                disabled={testing}
              >
                {testing ? "Probando..." : "Probar"}
              </Button>
              <Button type="submit" size="sm" className={BRASS_BUTTON_CLASS} disabled={addPending}>
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

function RuleItem({ rule, onRemoved }: { rule: DestinatarioRuleRow; onRemoved?: () => void }) {
  const [removing, startTransition] = useTransition();

  const matchCount = rule.match_count ?? 0;
  const lastMatchedAt = rule.last_matched_at;
  const STALE_DAYS = 90;
  const isStale = matchCount > 0 && lastMatchedAt
    && (Date.now() - new Date(lastMatchedAt).getTime()) > STALE_DAYS * 86_400_000;

  function handleRemove() {
    startTransition(async () => {
      const result = await removeDestinatarioRule(rule.id);
      if (result.success) {
        toast.success("Regla eliminada");
        onRemoved?.();
      } else {
        toast.error(result.error);
      }
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
          {isStale && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">Sin uso reciente</Badge>
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
