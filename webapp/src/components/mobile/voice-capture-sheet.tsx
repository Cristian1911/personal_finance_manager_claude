"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Mic,
  MicOff,
  Check,
  Loader2,
  ArrowUpRight,
  ArrowDownLeft,
  Send,
  ChevronDown,
  Wallet,
} from "lucide-react";
import { parseQuickCaptureText } from "@zeta/shared";
import type { ParsedQuickCapture, QuickCaptureMissingField } from "@zeta/shared";
import { createTransaction } from "@/actions/transactions";
import { parseVoiceCapture } from "@/actions/voice-capture";
import { useVoiceCapture } from "@/hooks/use-voice-capture";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import type { Account, CategoryWithChildren, CurrencyCode } from "@/types/domain";

// ── Types ────────────────────────────────────────────────────────────────────

interface VoiceCaptureSheetProps {
  accounts: Account[];
  categories: CategoryWithChildren[];
  onSuccess?: () => void;
}

type ChatMessage =
  | { role: "system"; text: string }
  | { role: "user"; text: string }
  | { role: "system"; type: "summary"; data: ParsedQuickCapture; accountName: string; currency: CurrencyCode }
  | { role: "system"; type: "direction-picker" }
  | { role: "system"; type: "success"; text: string };

type PendingField = Exclude<QuickCaptureMissingField, "account_id">;

const STORAGE_KEY = "zeta:voice-capture-account";

const FIELD_PROMPTS: Record<PendingField, string> = {
  amount: "¿Cuánto fue?",
  direction: "¿Fue un gasto o un ingreso?",
  description: "¿En qué fue?",
};

// ── Component ────────────────────────────────────────────────────────────────

export function VoiceCaptureSheet({
  accounts,
  categories,
  onSuccess,
}: VoiceCaptureSheetProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Account state
  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && accounts.some((a) => a.id === saved)) return saved;
    return "";
  });
  const [showAccountPicker, setShowAccountPicker] = useState(!selectedAccountId);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const currencyCode = (selectedAccount?.currency_code ?? "COP") as CurrencyCode;

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (!selectedAccountId) {
      return [{ role: "system", text: "Primero, elige tu cuenta principal para capturas rápidas." }];
    }
    return [{ role: "system", text: "Di tu movimiento o escríbelo abajo." }];
  });

  // Capture state — accumulates fields across turns
  const [captured, setCaptured] = useState<Partial<ParsedQuickCapture>>({});
  const [pendingField, setPendingField] = useState<PendingField | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [textInput, setTextInput] = useState("");

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // ── Account selection ──

  function selectAccount(accountId: string) {
    setSelectedAccountId(accountId);
    localStorage.setItem(STORAGE_KEY, accountId);
    setShowAccountPicker(false);

    const account = accounts.find((a) => a.id === accountId);
    setMessages((prev) => [
      ...prev,
      { role: "user", text: account?.name ?? accountId },
      { role: "system", text: "Listo. Ahora di tu movimiento o escríbelo." },
    ]);
  }

  // ── Process input (voice or text) ──

  const processInput = useCallback(
    async (input: string) => {
      if (!input.trim()) return;

      // Add user message
      setMessages((prev) => [...prev, { role: "user", text: input }]);

      // If we're filling a specific missing field, use local parse only
      if (pendingField) {
        const merged = { ...captured };

        if (pendingField === "amount") {
          // Try AI for written-out numbers like "quince" or "ochenta"
          const fieldResult = await parseVoiceCapture(input);
          const amount = fieldResult.success
            ? fieldResult.data.amount
            : parseFloat(input.replace(/[^\d.,]/g, "").replace(",", "."));
          if (!isNaN(amount) && amount > 0) {
            merged.amount = amount;
          } else {
            setMessages((prev) => [...prev, { role: "system", text: "No entendí el monto. Intenta con \"15 mil\", \"quince\" o \"25000\"." }]);
            return;
          }
        } else if (pendingField === "description") {
          merged.description = input.trim();
          merged.merchant_name = input.trim();
        }

        setCaptured(merged);
        setPendingField(null);
        checkCompleteness(merged, input);
        return;
      }

      // Fresh parse — show thinking indicator
      setMessages((prev) => [...prev, { role: "system", text: "Interpretando..." }]);

      const result = await parseVoiceCapture(input);

      // Remove the "Interpretando..." message
      setMessages((prev) => prev.filter((m, i) => i !== prev.length - 1 || !("text" in m && m.text === "Interpretando...")));

      if (result.success) {
        const data = result.data;
        setCaptured(data);
        const account = accounts.find((a) => a.id === selectedAccountId);
        setMessages((prev) => [
          ...prev,
          { role: "system", type: "summary", data, accountName: account?.name ?? "", currency: currencyCode },
        ]);
      } else {
        // Partial — ask for missing fields
        const partial: Partial<ParsedQuickCapture> = {
          raw_description: input,
          capture_input_text: input,
          transaction_date: new Date().toISOString().split("T")[0],
        };

        setCaptured(partial);
        const missing = result.missing_fields.filter((f): f is PendingField => f !== "account_id");
        askNextField(missing);
      }
    },
    [captured, pendingField, selectedAccountId, currencyCode, accounts],
  );

  function checkCompleteness(data: Partial<ParsedQuickCapture>, latestInput: string) {
    const missing: PendingField[] = [];
    if (!data.amount) missing.push("amount");
    if (!data.direction) missing.push("direction");
    if (!data.description) missing.push("description");

    if (missing.length === 0) {
      // All fields present — build full ParsedQuickCapture and show summary
      const full: ParsedQuickCapture = {
        input: data.capture_input_text ?? latestInput,
        amount: data.amount!,
        direction: data.direction!,
        transaction_date: data.transaction_date ?? new Date().toISOString().split("T")[0],
        description: data.description!,
        merchant_name: data.merchant_name ?? data.description!,
        raw_description: data.raw_description ?? latestInput,
        capture_input_text: data.capture_input_text ?? latestInput,
        missing_fields: ["account_id"],
        confidence: 0.9,
      };
      setCaptured(full);
      const account = accounts.find((a) => a.id === selectedAccountId);
      setMessages((prev) => [
        ...prev,
        { role: "system", type: "summary", data: full, accountName: account?.name ?? "", currency: currencyCode },
      ]);
    } else {
      askNextField(missing);
    }
  }

  function askNextField(missing: PendingField[]) {
    const next = missing[0];
    setPendingField(next);
    if (next === "direction") {
      setMessages((prev) => [...prev, { role: "system", type: "direction-picker" }]);
    } else {
      setMessages((prev) => [...prev, { role: "system", text: FIELD_PROMPTS[next] }]);
    }
  }

  // ── Direction picker ──

  function selectDirection(dir: "INFLOW" | "OUTFLOW") {
    const label = dir === "OUTFLOW" ? "Gasto" : "Ingreso";
    setMessages((prev) => [...prev, { role: "user", text: label }]);
    const merged = { ...captured, direction: dir };
    setCaptured(merged);
    setPendingField(null);
    checkCompleteness(merged, "");
  }

  // ── Confirm transaction ──

  const handleConfirm = useCallback(async () => {
    if (!captured.amount || !captured.direction || !captured.description) return;

    setSubmitting(true);
    const formData = new FormData();
    formData.set("account_id", selectedAccountId);
    formData.set("amount", String(captured.amount));
    formData.set("currency_code", currencyCode);
    formData.set("direction", captured.direction);
    formData.set("transaction_date", captured.transaction_date ?? new Date().toISOString().split("T")[0]);
    formData.set("merchant_name", captured.description);
    formData.set("raw_description", captured.raw_description ?? captured.description);
    formData.set("capture_input_text", captured.capture_input_text ?? captured.description);
    formData.set("is_subscription", "false");
    formData.set("create_destinatario", "false");
    formData.set("create_recurring_template", "false");

    localStorage.setItem(STORAGE_KEY, selectedAccountId);

    const result = await createTransaction({ success: false, error: "" }, formData);
    setSubmitting(false);

    if (result.success) {
      setMessages((prev) => [
        ...prev,
        { role: "system", type: "success", text: `Registrado: ${formatCurrency(captured.amount!, currencyCode)} · ${captured.description}` },
      ]);
      setTimeout(() => {
        router.refresh();
        onSuccess?.();
      }, 1200);
    } else {
      setMessages((prev) => [...prev, { role: "system", text: `Error: ${result.error}` }]);
    }
  }, [captured, selectedAccountId, currencyCode, router, onSuccess]);

  // ── Voice ──

  const voice = useVoiceCapture({
    onResult: (transcript) => processInput(transcript),
  });

  // ── Text submit ──

  function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!textInput.trim()) return;
    processInput(textInput);
    setTextInput("");
  }

  // ── Unsupported browser ──

  if (!voice.supported) {
    // Still allow text input even without voice
  }

  // ── Render ──

  return (
    <div className="flex flex-col">
      {/* Account chip — tappable */}
      {selectedAccountId && !showAccountPicker && (
        <button
          type="button"
          onClick={() => setShowAccountPicker(true)}
          className="mb-2 flex items-center gap-2 self-start rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50"
        >
          <Wallet className="size-3" />
          {selectedAccount?.name ?? "Cuenta"}
          <ChevronDown className="size-3" />
        </button>
      )}

      {/* Account picker overlay */}
      {showAccountPicker && (
        <div className="mb-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {selectedAccountId ? "Cambiar cuenta" : "Elige tu cuenta principal"}
          </p>
          <div className="grid gap-1.5">
            {accounts.map((acc) => (
              <button
                key={acc.id}
                type="button"
                onClick={() => selectAccount(acc.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                  acc.id === selectedAccountId
                    ? "border-primary bg-primary/10"
                    : "border-border/60 hover:bg-accent/50",
                )}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: acc.color ?? undefined }}
                />
                <span className="font-medium">{acc.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{acc.currency_code}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat messages */}
      {!showAccountPicker && (
        <>
          <div ref={scrollRef} className="space-y-3 overflow-y-auto overscroll-contain pb-3" style={{ maxHeight: "min(45dvh, 22rem)" }}>
            {messages.map((msg, i) => {
              if (msg.role === "user") {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-z-brass/15 px-4 py-2.5 text-sm text-foreground">
                      {msg.text}
                    </div>
                  </div>
                );
              }

              if ("type" in msg && msg.type === "summary") {
                const isOutflow = msg.data.direction === "OUTFLOW";
                return (
                  <div key={i} className="space-y-3">
                    <div className="rounded-2xl rounded-bl-md border border-border/60 bg-card px-4 py-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {isOutflow ? <ArrowUpRight className="size-3 text-z-expense" /> : <ArrowDownLeft className="size-3 text-z-income" />}
                        <span>{isOutflow ? "Gasto" : "Ingreso"}</span>
                        <span className="ml-auto">{msg.accountName}</span>
                      </div>
                      <p className={cn("mt-1 text-xl font-bold tabular-nums", isOutflow ? "text-z-expense" : "text-z-income")}>
                        {formatCurrency(msg.data.amount, msg.currency)}
                      </p>
                      <p className="mt-0.5 text-sm text-foreground">{msg.data.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{msg.data.transaction_date}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={handleConfirm}
                        disabled={submitting}
                      >
                        {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                        Registrar
                      </Button>
                    </div>
                  </div>
                );
              }

              if ("type" in msg && msg.type === "direction-picker") {
                return (
                  <div key={i} className="space-y-2">
                    <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-muted/40 px-4 py-2.5 text-sm text-foreground">
                      ¿Fue un gasto o un ingreso?
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={() => selectDirection("OUTFLOW")}
                      >
                        <ArrowUpRight className="size-3.5 text-z-expense" />
                        Gasto
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={() => selectDirection("INFLOW")}
                      >
                        <ArrowDownLeft className="size-3.5 text-z-income" />
                        Ingreso
                      </Button>
                    </div>
                  </div>
                );
              }

              if ("type" in msg && msg.type === "success") {
                return (
                  <div key={i} className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-z-income/30 bg-z-income/10 px-4 py-2.5 text-sm text-z-income">
                      <Check className="mb-0.5 mr-1 inline size-3.5" />
                      {msg.text}
                    </div>
                  </div>
                );
              }

              return (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-muted/40 px-4 py-2.5 text-sm text-foreground">
                    {msg.text}
                  </div>
                </div>
              );
            })}

            {/* Live transcript while listening */}
            {voice.state === "listening" && voice.transcript && (
              <div className="flex justify-end">
                <div className="max-w-[85%] animate-pulse rounded-2xl rounded-br-md border border-z-brass/30 bg-z-brass/10 px-4 py-2.5 text-sm italic text-foreground">
                  {voice.transcript}...
                </div>
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className="shrink-0 border-t border-border/60 pt-3">
            {voice.error && (
              <p className="mb-2 text-xs text-destructive">{voice.error}</p>
            )}
            <form onSubmit={handleTextSubmit} className="flex items-center gap-2">
              {/* Mic button */}
              {voice.supported && (
                <button
                  type="button"
                  onClick={voice.state === "listening" ? voice.stop : voice.start}
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full transition-all",
                    voice.state === "listening"
                      ? "bg-z-debt/20 text-z-debt animate-pulse"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                  )}
                  aria-label={voice.state === "listening" ? "Detener" : "Hablar"}
                >
                  {voice.state === "listening" ? (
                    <MicOff className="size-5" />
                  ) : voice.state === "processing" ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <Mic className="size-5" />
                  )}
                </button>
              )}

              {/* Text input */}
              <Input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={pendingField ? FIELD_PROMPTS[pendingField] : "Ej: gasté 15k en café"}
                className="flex-1"
                disabled={voice.state === "listening"}
              />

              {/* Send button */}
              <button
                type="submit"
                disabled={!textInput.trim() || voice.state === "listening"}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-z-brass text-z-ink transition-colors hover:bg-z-brass/90 disabled:opacity-40"
                aria-label="Enviar"
              >
                <Send className="size-5" />
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
