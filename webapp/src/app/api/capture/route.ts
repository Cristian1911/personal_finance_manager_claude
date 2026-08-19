import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { flowClassColumns } from "@/lib/utils/flow-class-columns";
import { authenticateCaptureToken } from "@/app/api/_shared/capture-auth";
import { autoCategorize } from "@zeta/shared";
import { matchTransactionToDestinatario } from "@/actions/destinatarios";
import { computeIdempotencyKey } from "@/lib/utils/idempotency";
import { parseVoiceCapture } from "@/actions/voice-capture";
import { format } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────────────

type CaptureRequest = {
  type: "text";
  content: string;
  account_id?: string;
  category_id?: string;
};

type CaptureResponse =
  | {
      status: "created";
      transaction: {
        id: string;
        amount: number;
        direction: string;
        description: string;
        category: string | null;
        account_id: string;
        date: string;
      };
      message: string;
    }
  | {
      status: "needs_confirmation";
      parsed: {
        amount: number | null;
        direction: string | null;
        description: string | null;
        date: string;
      };
      missing_fields: string[];
      message: string;
    }
  | { status: "error"; message: string };

// ── Route handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse<CaptureResponse>> {
  // Auth
  const auth = await authenticateCaptureToken(request);
  if (!auth) {
    return NextResponse.json(
      { status: "error", message: "Token inválido o revocado. Genera uno nuevo en Ajustes." },
      { status: 401 },
    );
  }

  // Parse body
  let body: CaptureRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", message: "JSON inválido" },
      { status: 400 },
    );
  }

  if (body.type !== "text" || !body.content?.trim()) {
    return NextResponse.json(
      { status: "error", message: "Se requiere type: 'text' y content no vacío" },
      { status: 400 },
    );
  }

  // Resolve account
  const accountId = body.account_id ?? auth.defaultAccountId;
  if (!accountId) {
    return NextResponse.json(
      {
        status: "error",
        message: "No hay cuenta por defecto. Envía account_id o configura una cuenta predeterminada.",
      },
      { status: 400 },
    );
  }

  // Parse the text (regex → Gemini Flash fallback)
  const parseResult = await parseVoiceCapture(body.content);

  if (!parseResult.success) {
    const missing = parseResult.missing_fields.filter((f) => f !== "account_id");
    return NextResponse.json({
      status: "needs_confirmation",
      parsed: {
        amount: null,
        direction: null,
        description: null,
        date: format(new Date(), "yyyy-MM-dd"),
      },
      missing_fields: missing,
      message: `No pude interpretar todo. Faltan: ${missing.join(", ")}`,
    });
  }

  const { amount, direction, description, merchant_name, transaction_date, capture_input_text } =
    parseResult.data;

  // Verify the account belongs to the user
  const admin = createAdminClient();
  const { data: account } = await admin
    .from("accounts")
    .select("id, currency_code, account_type")
    .eq("id", accountId)
    .eq("user_id", auth.userId)
    .single();

  if (!account) {
    return NextResponse.json(
      { status: "error", message: "Cuenta no encontrada o no pertenece a este usuario." },
      { status: 404 },
    );
  }

  // Destinatario match → auto-categorize fallback
  const matchText = merchant_name ?? capture_input_text ?? "";
  const destMatch = await matchTransactionToDestinatario(auth.userId, matchText, admin);

  let categoryId = body.category_id ?? null;
  let destinatarioId: string | null = null;
  let categorizationSource: "USER_LEARNED" | "SYSTEM_DEFAULT" | undefined;

  if (destMatch) {
    destinatarioId = destMatch.destinatario_id;
    categoryId = categoryId ?? destMatch.category_id;
    categorizationSource = categoryId ? "USER_LEARNED" : undefined;
  }

  if (!categoryId) {
    categoryId = autoCategorize(merchant_name)?.category_id ?? null;
    if (categoryId) categorizationSource = "SYSTEM_DEFAULT";
  }

  // Compute idempotency key
  const idempotencyKey = await computeIdempotencyKey({
    provider: "CAPTURE_API",
    transactionDate: transaction_date,
    amount,
    rawDescription: capture_input_text,
  });

  // Insert transaction
  const { data: tx, error: insertError } = await admin
    .from("transactions")
    .insert({
      user_id: auth.userId,
      account_id: accountId,
      amount,
      currency_code: account.currency_code,
      direction,
      transaction_date,
      raw_description: capture_input_text,
      clean_description: description,
      merchant_name,
      category_id: categoryId,
      destinatario_id: destinatarioId,
      idempotency_key: idempotencyKey,
      provider: "MANUAL",
      capture_method: "TEXT_QUICK_CAPTURE",
      capture_input_text,
      categorization_source: categorizationSource,
      ...flowClassColumns({
        direction,
        accountType: account.account_type,
        description: merchant_name ?? description ?? capture_input_text,
      }),
    })
    .select("id, amount, direction, merchant_name, category_id, account_id, transaction_date")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({
        status: "error",
        message: "Esta transacción ya fue registrada (duplicada).",
      });
    }
    return NextResponse.json(
      { status: "error", message: insertError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    status: "created",
    transaction: {
      id: tx.id,
      amount: tx.amount,
      direction: tx.direction,
      description: tx.merchant_name ?? description,
      category: tx.category_id,
      account_id: tx.account_id,
      date: tx.transaction_date,
    },
    message: `Registrado: $${amount.toLocaleString()} · ${description} · ${transaction_date}`,
  });
}
