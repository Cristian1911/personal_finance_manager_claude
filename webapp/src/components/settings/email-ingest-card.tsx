"use client";

import { useState, useTransition } from "react";
import { Mail, Copy, Check, PowerOff, Loader2, ExternalLink, ShieldCheck, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  generateIngestAddress,
  updateIngestSettings,
  deactivateIngestAddress,
  clearGmailVerification,
  addAllowedSender,
  removeAllowedSender,
  type AllowedSender,
} from "@/actions/email-ingest";
import { cn } from "@/lib/utils";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import type { Account, EmailIngestAddress } from "@/types/domain";

const EMAIL_DOMAIN =
  process.env.NEXT_PUBLIC_EMAIL_INGEST_DOMAIN ?? "ingest.zeta.example.com";

interface EmailIngestCardProps {
  accounts: Account[];
  initialAddress: EmailIngestAddress | null;
  initialAllowedSenders: AllowedSender[];
}

export function EmailIngestCard({ accounts, initialAddress, initialAllowedSenders }: EmailIngestCardProps) {
  const [address, setAddress] = useState(initialAddress);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [allowedSenders, setAllowedSenders] = useState(initialAllowedSenders);
  const [newSenderEmail, setNewSenderEmail] = useState("");

  const fullEmail = address ? `${address.address_key}@${EMAIL_DOMAIN}` : null;

  function copyToClipboard() {
    if (!fullEmail) return;
    navigator.clipboard.writeText(fullEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleActivate() {
    startTransition(async () => {
      const result = await generateIngestAddress();
      if (result.success) {
        setAddress(result.data);
      }
    });
  }

  function handleDeactivate() {
    startTransition(async () => {
      const result = await deactivateIngestAddress();
      if (result.success) {
        setAddress(null);
      }
    });
  }

  function handleAccountChange(accountId: string) {
    if (!address) return;
    const resolvedId = accountId === "__none__" ? null : accountId;
    startTransition(async () => {
      const result = await updateIngestSettings({
        accountId: resolvedId,
        autoImport: address.auto_import ?? false,
      });
      if (result.success) {
        setAddress(result.data);
      }
    });
  }

  function handleAutoImportToggle(checked: boolean) {
    if (!address) return;
    startTransition(async () => {
      const result = await updateIngestSettings({
        accountId: address.account_id ?? null,
        autoImport: checked,
      });
      if (result.success) {
        setAddress(result.data);
      }
    });
  }

  function handlePdfImportToggle(checked: boolean) {
    if (!address) return;
    startTransition(async () => {
      const result = await updateIngestSettings({
        accountId: address.account_id ?? null,
        autoImport: address.auto_import ?? false,
        pdfImportEnabled: checked,
      });
      if (result.success) {
        setAddress(result.data);
      }
    });
  }

  function handleAddSender() {
    const email = newSenderEmail.trim();
    if (!email) return;
    startTransition(async () => {
      const result = await addAllowedSender(email);
      if (result.success) {
        setAllowedSenders((prev) => [...prev, result.data]);
        setNewSenderEmail("");
      }
    });
  }

  return (
    <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/6 bg-black/10">
            <Mail className="size-4 text-z-brass" />
          </div>
          <div className="space-y-1">
            <CardTitle>Importación por correo</CardTitle>
            <p className="text-sm text-muted-foreground">
              Reenvía los correos de alerta de tus bancos a una dirección única y Zeta extrae las transacciones automáticamente.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {!address ? (
          /* ── Estado sin dirección generada ── */
          <div className="space-y-4">
            <div className="rounded-lg border border-border/40 bg-muted/10 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
              <p className="mb-1.5 font-medium text-foreground/80">Cómo funciona:</p>
              <ol className="list-inside list-decimal space-y-0.5">
                <li>Activa la importación para obtener tu dirección única</li>
                <li>En tu app de correo, crea una regla que reenvíe los correos de tu banco a esa dirección</li>
                <li>Cada vez que recibas una alerta bancaria, Zeta la procesa automáticamente</li>
                <li>Revisa y aprueba las transacciones detectadas desde el panel de importación</li>
              </ol>
            </div>
            <Button
              onClick={handleActivate}
              disabled={isPending}
              className={cn(BRASS_BUTTON_CLASS, "w-full gap-2")}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mail className="size-4" />
              )}
              Activar importación por correo
            </Button>
          </div>
        ) : (
          /* ── Estado activo ── */
          <div className="space-y-5">
            {/* Dirección generada */}
            <div className="space-y-1.5">
              <Label className="text-xs">Tu dirección de importación</Label>
              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
                <code className="flex-1 truncate text-xs">{fullEmail}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 shrink-0 p-0"
                  onClick={copyToClipboard}
                  title="Copiar dirección"
                >
                  {copied ? (
                    <Check className="size-3.5 text-z-income" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
              </div>
            </div>

            {/* Gmail verification banner */}
            {address.gmail_verification_url && (
              <div className="rounded-lg border border-z-brass/30 bg-z-brass/5 px-3 py-3 space-y-2">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="size-4 text-z-brass mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-z-brass">
                      Verificación de Gmail pendiente
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Gmail necesita que confirmes el reenvío. Haz clic en el enlace para activar
                      el reenvío automático de correos a Zeta.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <a
                    href={address.gmail_verification_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(BRASS_BUTTON_CLASS, "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium")}
                  >
                    <ExternalLink className="size-3.5" />
                    Confirmar reenvío
                  </a>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground"
                    disabled={isPending}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await clearGmailVerification();
                        if (result.success) {
                          setAddress((prev) =>
                            prev
                              ? { ...prev, gmail_verification_url: null, gmail_verification_at: null }
                              : prev
                          );
                        }
                      });
                    }}
                  >
                    Ya lo confirmé
                  </Button>
                </div>
              </div>
            )}

            {/* Instrucciones */}
            <div className="rounded-lg border border-border/40 bg-muted/10 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
              <p className="mb-1.5 font-medium text-foreground/80">Cómo configurar el reenvío:</p>
              <ol className="list-inside list-decimal space-y-0.5">
                <li>Copia la dirección de arriba</li>
                <li>En Gmail: Configuración → Filtros → Crear filtro → De: (dominio de tu banco) → Reenviar a</li>
                <li>En Outlook: Reglas → Nueva regla → De: (tu banco) → Reenviar a</li>
                <li>Las transacciones aparecerán en el panel de importación para que las revises</li>
              </ol>
            </div>

            {/* Cuenta predeterminada */}
            <div className="space-y-1.5">
              <Label className="text-xs">Cuenta predeterminada</Label>
              <Select
                value={address.account_id ?? "__none__"}
                onValueChange={handleAccountChange}
                disabled={isPending}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Sin cuenta asignada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin cuenta asignada</SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} ({acc.currency_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Las transacciones se asignarán a esta cuenta si no se detecta otra automáticamente.
              </p>
            </div>

            {/* Allowed sender for forwarding */}
            <div className="space-y-1.5">
              <Label className="text-xs">Correo de reenvío (opcional)</Label>
              <Input
                type="email"
                placeholder="tucorreo@gmail.com"
                defaultValue={address.allowed_sender ?? ""}
                className="h-9 text-sm"
                disabled={isPending}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  if (value === (address.allowed_sender ?? "")) return;
                  startTransition(async () => {
                    const result = await updateIngestSettings({
                      accountId: address.account_id ?? null,
                      autoImport: address.auto_import ?? false,
                      allowedSender: value || null,
                    });
                    if (result.success) setAddress(result.data);
                  });
                }}
              />
              <p className="text-xs text-muted-foreground">
                Si reenvías los correos de tu banco desde tu correo personal, ingresa esa dirección aquí para que Zeta los acepte.
              </p>
            </div>

            {/* Allowed bank senders */}
            <div className="space-y-2">
              <Label className="text-xs">Remitentes bancarios permitidos</Label>
              <p className="text-xs text-muted-foreground">
                Agrega las direcciones de correo de tu banco para que Zeta las acepte. Los remitentes de Bancolombia se incluyen por defecto.
              </p>

              {allowedSenders.length > 0 && (
                <div className="space-y-1.5">
                  {allowedSenders.map((sender) => (
                    <div
                      key={sender.id}
                      className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/10 px-2.5 py-1.5"
                    >
                      <code className="flex-1 truncate text-xs">{sender.sender_email}</code>
                      {sender.label && (
                        <span className="shrink-0 text-xs text-muted-foreground">{sender.label}</span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Eliminar remitente"
                        className="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                        disabled={isPending}
                        onClick={() => {
                          startTransition(async () => {
                            const result = await removeAllowedSender(sender.id);
                            if (result.success) {
                              setAllowedSenders((prev) => prev.filter((s) => s.id !== sender.id));
                            }
                          });
                        }}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="alertas@banco.com"
                  value={newSenderEmail}
                  onChange={(e) => setNewSenderEmail(e.target.value)}
                  className="h-8 flex-1 text-xs"
                  disabled={isPending}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddSender();
                    }
                  }}
                />
                <Button
                  className={cn(GHOST_BUTTON_CLASS, "h-8 gap-1 px-2.5 text-xs")}
                  disabled={isPending || !newSenderEmail.trim()}
                  onClick={handleAddSender}
                >
                  <Plus className="size-3.5" />
                  Agregar
                </Button>
              </div>
            </div>

            {/* Auto-import toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/10 px-3 py-2.5">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Importar automáticamente</p>
                <p className="text-xs text-muted-foreground">
                  Si está activo, las transacciones se crean sin pasar por revisión manual.
                </p>
              </div>
              <Switch
                checked={address.auto_import ?? false}
                onCheckedChange={handleAutoImportToggle}
                disabled={isPending}
              />
            </div>

            {/* PDF import toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/10 px-3 py-2.5">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Importar extractos PDF adjuntos</p>
                <p className="text-xs text-muted-foreground">
                  Cuando un correo llega con un PDF adjunto de extracto bancario, se procesará automáticamente.
                </p>
              </div>
              <Switch
                checked={address.pdf_import_enabled ?? false}
                onCheckedChange={handlePdfImportToggle}
                disabled={isPending}
              />
            </div>

            {/* Desactivar */}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-destructive hover:text-destructive"
              onClick={handleDeactivate}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <PowerOff className="size-4" />
              )}
              Desactivar importación por correo
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
