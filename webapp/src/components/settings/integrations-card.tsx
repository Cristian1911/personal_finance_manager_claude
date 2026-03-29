"use client";

import { useState, useTransition } from "react";
import {
  Plug,
  Plus,
  Copy,
  Check,
  Trash2,
  MessageCircle,
  Bot,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createCaptureToken,
  createTelegramLink,
  revokeCaptureToken,
  type CaptureToken,
} from "@/actions/capture-tokens";
import { cn } from "@/lib/utils";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import type { Account } from "@/types/domain";

interface IntegrationsCardProps {
  accounts: Account[];
  tokens: CaptureToken[];
}

export function IntegrationsCard({ accounts, tokens: initialTokens }: IntegrationsCardProps) {
  const [tokens, setTokens] = useState(initialTokens);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);
  const [newTokenLabel, setNewTokenLabel] = useState("");
  const [newTokenAccount, setNewTokenAccount] = useState(accounts[0]?.id ?? "");
  const [showNewToken, setShowNewToken] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  const telegramToken = tokens.find((t) => t.label.startsWith("telegram:"));
  const telegramLinked = telegramToken && !telegramToken.label.includes("pending");

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  function handleCreateToken() {
    const formData = new FormData();
    formData.set("label", newTokenLabel || "API");
    formData.set("default_account_id", newTokenAccount);

    startTransition(async () => {
      const result = await createCaptureToken({ success: false, error: "" }, formData);
      if (result.success) {
        setTokens((prev) => [result.data, ...prev]);
        setCreatedToken(result.data.token);
        setShowNewToken(false);
        setNewTokenLabel("");
      }
    });
  }

  function handleRevoke(id: string) {
    const isCreatedToken =
      createdToken != null && tokens.find((t) => t.id === id)?.token === createdToken;

    startTransition(async () => {
      const result = await revokeCaptureToken(id);
      if (result.success) {
        setTokens((prev) => prev.filter((t) => t.id !== id));
        if (isCreatedToken) setCreatedToken(null);
      }
    });
  }

  function handleConnectTelegram() {
    if (!newTokenAccount) return;
    startTransition(async () => {
      const result = await createTelegramLink(newTokenAccount);
      if (result.success) {
        window.open(result.data.deepLink, "_blank");
        // Refresh tokens to show the new telegram token
        setTokens((prev) => {
          const existing = prev.find((t) => t.token === result.data.token);
          if (existing) return prev;
          return [
            {
              id: "",
              token: result.data.token,
              label: "telegram:pending",
              default_account_id: newTokenAccount,
              created_at: new Date().toISOString(),
              last_used_at: null,
              revoked_at: null,
            },
            ...prev,
          ];
        });
      }
    });
  }

  return (
    <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/6 bg-black/10">
            <Plug className="size-4 text-z-brass" />
          </div>
          <div className="space-y-1">
            <CardTitle>Conexiones e integraciones</CardTitle>
            <p className="text-sm text-muted-foreground">
              Conecta Zeta con apps externas para capturar gastos sin abrir la app.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ── Telegram ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="size-4 text-[#26A5E4]" />
            <h4 className="text-sm font-semibold">Telegram</h4>
            {telegramLinked && (
              <span className="rounded-full bg-z-income/15 px-2 py-0.5 text-[10px] font-semibold text-z-income">
                Conectado
              </span>
            )}
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Registra gastos desde Telegram sin abrir Zeta. Escribe al bot de forma natural
            y el sistema interpreta monto, tipo y concepto automáticamente.
          </p>
          <div className="rounded-lg border border-border/40 bg-muted/10 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
            <p className="mb-1.5 font-medium text-foreground/80">Cómo funciona:</p>
            <ol className="list-inside list-decimal space-y-0.5">
              <li>Elige la cuenta donde se registrarán los gastos</li>
              <li>Toca &quot;Conectar Telegram&quot; — se abre el bot</li>
              <li>Toca &quot;Iniciar&quot; en Telegram — queda vinculado</li>
              <li>Envía mensajes como: <em>&quot;Almuerzo 25 mil&quot;</em> o <em>&quot;Me pagaron 500k&quot;</em></li>
            </ol>
          </div>

          {!telegramLinked ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Cuenta predeterminada</Label>
                <Select value={newTokenAccount} onValueChange={setNewTokenAccount}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Seleccionar cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name} ({acc.currency_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleConnectTelegram}
                disabled={isPending || !newTokenAccount}
                className={cn(BRASS_BUTTON_CLASS, "w-full gap-2")}
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ExternalLink className="size-4" />
                )}
                Conectar Telegram
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
              <div className="space-y-0.5">
                <p className="text-xs font-medium">Bot vinculado</p>
                <p className="text-xs text-muted-foreground">
                  Envía mensajes al bot para registrar gastos.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => telegramToken && handleRevoke(telegramToken.id)}
                disabled={isPending}
              >
                Desconectar
              </Button>
            </div>
          )}
        </div>

        <hr className="border-border/40" />

        {/* ── MCP (AI Assistants) ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Bot className="size-4 text-z-brass" />
            <h4 className="text-sm font-semibold">Asistentes de IA (MCP)</h4>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Conecta Claude Desktop, ChatGPT u otros asistentes de IA que soporten MCP para consultar
            tus finanzas y registrar gastos directamente desde la conversación.
          </p>
          <div className="rounded-lg border border-border/40 bg-muted/10 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
            <p className="mb-1.5 font-medium text-foreground/80">Cómo configurar:</p>
            <ol className="list-inside list-decimal space-y-0.5">
              <li>Genera un token de captura abajo</li>
              <li>Copia el token (solo se muestra una vez)</li>
              <li>En Claude Desktop, abre Configuración → MCP Servers</li>
              <li>Agrega un servidor con tu token como <code className="rounded bg-black/20 px-1">ZETA_CAPTURE_TOKEN</code></li>
            </ol>
            <p className="mt-2 font-medium text-foreground/80">Qué puede hacer tu asistente:</p>
            <ul className="list-inside list-disc space-y-0.5">
              <li>&quot;¿Cuánto he gastado en restaurantes este mes?&quot;</li>
              <li>&quot;¿Cómo va mi presupuesto?&quot;</li>
              <li>&quot;Registra que pagué 80 mil al dentista&quot;</li>
              <li>&quot;¿Me puedo comprar unos zapatos de 200k?&quot;</li>
            </ul>
          </div>
        </div>

        <hr className="border-border/40" />

        {/* ── Tokens de captura ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold">Tokens de captura</h4>
              <p className="text-xs text-muted-foreground">
                Llaves de acceso para integraciones externas. Cada token tiene una cuenta predeterminada.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setShowNewToken(true)}
              disabled={showNewToken}
            >
              <Plus className="size-3" />
              Nuevo
            </Button>
          </div>

          {/* New token form */}
          {showNewToken && (
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/10 p-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nombre</Label>
                <Input
                  value={newTokenLabel}
                  onChange={(e) => setNewTokenLabel(e.target.value)}
                  placeholder="Ej: Claude Desktop, API personal"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cuenta predeterminada</Label>
                <Select value={newTokenAccount} onValueChange={setNewTokenAccount}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name} ({acc.currency_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={handleCreateToken}
                  disabled={isPending}
                >
                  {isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Generar token"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewToken(false)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Just-created token (shown once) */}
          {createdToken && (
            <div className="rounded-lg border border-z-brass/30 bg-z-brass/5 p-3">
              <p className="mb-1.5 text-xs font-medium text-z-brass">
                Token creado — copia ahora, no se mostrará de nuevo
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-black/20 px-2 py-1 text-xs">
                  {createdToken}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 shrink-0 p-0"
                  onClick={() => copyToClipboard(createdToken, "new")}
                >
                  {copied === "new" ? (
                    <Check className="size-3.5 text-z-income" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Token list */}
          {(() => {
            const apiTokens = tokens.filter((t) => !t.label.startsWith("telegram:"));
            if (apiTokens.length === 0 && !createdToken) {
              return (
                <p className="text-xs text-muted-foreground">
                  Sin tokens activos. Genera uno para conectar un asistente de IA.
                </p>
              );
            }
            return apiTokens.map((token) => (
              <div
                key={token.id}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="text-xs font-medium">{token.label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {token.token.slice(0, 12)}...{token.token.slice(-6)}
                    {token.last_used_at && (
                      <> · Usado {new Date(token.last_used_at).toLocaleDateString("es-CO")}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => copyToClipboard(token.token, token.id)}
                  >
                    {copied === token.id ? (
                      <Check className="size-3.5 text-z-income" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleRevoke(token.id)}
                    disabled={isPending}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ));
          })()}
        </div>
      </CardContent>
    </Card>
  );
}
