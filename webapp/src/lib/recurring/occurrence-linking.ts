import "server-only";
import { addDays, parseISO } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getDebtPaymentCategoryId,
  occurrenceAmountMatches,
  OCCURRENCE_AUTO_LINK_DAY_WINDOW,
} from "@zeta/shared";
import { getExchangeRate } from "@/actions/exchange-rate";
import { applyDebtPaymentToBalances } from "@/lib/debt/payoff";
import { isDebtAccountType, reverseAccountBalanceDelta } from "@/lib/utils/account-balance";
import { toColombiaDateString } from "@/lib/utils/date";
import { flowClassColumns } from "@/lib/utils/flow-class-columns";
import { computeIdempotencyKey } from "@/lib/utils/idempotency";
import { UUID_RE } from "@/lib/validators/shared";
import type { ActionResult } from "@/types/actions";
import type { Database } from "@/types/database";
import type { CurrencyCode } from "@/types/domain";

/**
 * Auto-link of a just-created transaction to its pending recurring
 * occurrence. Lives outside `actions/occurrences.ts` because it has two kinds
 * of callers: server actions (the user's JWT client — see the wrappers there)
 * and route handlers such as the email-ingest webhook, which only have the
 * service-role client and the resolved `userId`. The webhook used to call the
 * server action, whose `getAuthenticatedClient()` found no session and
 * silently skipped the link — auto-imported email payments never marked
 * their recurring occurrence paid.
 */
export type OccurrenceLinkContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
  /**
   * Service-role client: encrypted views decrypt to NULL and their
   * INSTEAD OF UPDATE triggers must be bypassed (writes go to `_enc`).
   */
  isAdmin: boolean;
  /** Cache invalidation — `updateTag` in actions, `revalidateTag` in route handlers. */
  invalidate: () => void;
};

/**
 * Converts a transaction amount into each template currency the matcher
 * meets, memoizing one rate per target within the call. A USD charge on a
 * COP-billed card ("ANTHROPIC* CLAUDE SUB", US$100) must be compared with a
 * COP template at the day's rate — raw "100 vs 333.493" never matches.
 * Returns null when the rate can't be resolved: the caller then treats the
 * pair as a non-match instead of comparing across currencies.
 */
export function createAmountConverter(fromCurrency: string | null | undefined) {
  const rates = new Map<string, Promise<number | null>>();
  return async (
    amount: number,
    toCurrency: string | null | undefined,
  ): Promise<number | null> => {
    if (!fromCurrency || !toCurrency || fromCurrency === toCurrency) return amount;
    let rate = rates.get(toCurrency);
    if (!rate) {
      rate = getExchangeRate(fromCurrency as CurrencyCode, toCurrency as CurrencyCode)
        .then((r) => (r && Number.isFinite(r.rate) && r.rate > 0 ? r.rate : null))
        .catch(() => null);
      rates.set(toCurrency, rate);
    }
    const resolved = await rate;
    return resolved == null ? null : amount * resolved;
  };
}

/** Minimal template shape for cross-account debt matching queries. */
export type TemplateWithAccount = {
  account_id: string;
  direction: "INFLOW" | "OUTFLOW";
  transfer_source_account_id: string | null;
  account: { account_type: string } | null;
};

/** True when an OUTFLOW tx from a source account matches an INFLOW template on a debt account. */
export function isCrossAccountDebtPayment(
  template: TemplateWithAccount,
  txDirection: "INFLOW" | "OUTFLOW",
  txAccountId: string,
): boolean {
  return (
    template.direction === "INFLOW" &&
    txDirection === "OUTFLOW" &&
    template.transfer_source_account_id === txAccountId &&
    template.account != null &&
    isDebtAccountType(template.account.account_type)
  );
}

/**
 * Mark an occurrence as paid and link it to a pre-existing transaction (auto-link path).
 * Only transitions from 'pending'.
 *
 * Stamps `recurrence_group_id` on the transaction so the "Vincular" button hides,
 * and sets `linked_manually = true` on the occurrence so revertOccurrence unlinks
 * the imported/manual transaction instead of deleting it.
 */
export async function markOccurrencePaidWith(
  ctx: OccurrenceLinkContext,
  occurrenceId: string,
  transactionId: string,
): Promise<ActionResult> {
  const { supabase, userId } = ctx;

  if (!UUID_RE.test(occurrenceId) || !UUID_RE.test(transactionId)) {
    return { success: false, error: "ID inválido" };
  }

  const { data: occurrence, error } = await supabase
    .from("recurring_occurrences")
    .update({
      status: "paid",
      transaction_id: transactionId,
      paid_at: new Date().toISOString(),
      linked_manually: true,
    })
    .eq("id", occurrenceId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("template_id, occurrence_date, template:recurring_transaction_templates!recurring_occurrences_template_id_fkey(frequency, category_id, destinatario_id)")
    .single();

  if (error) return { success: false, error: error.message };

  // Stamp recurrence_group_id on the linked transaction so visibility predicates
  // (movimientos / inicio "Vincular" button) correctly hide it. Use the same
  // deterministic UUID scheme as linkExistingTransactionToOccurrence so both
  // paths share group identity.
  if (occurrence?.template_id && occurrence?.occurrence_date) {
    const { computeRecurringGroupUuid } = await import("@/actions/recurring-templates");
    const recurrenceGroupId = await computeRecurringGroupUuid(
      occurrence.template_id,
      occurrence.occurrence_date,
    );
    const template = occurrence.template as {
      frequency: string;
      category_id: string | null;
      destinatario_id: string | null;
    } | null;

    // Read existing tx to decide if we should backfill category / destinatario
    const { data: tx } = await supabase
      .from("transactions")
      .select("category_id, destinatario_id")
      .eq("id", transactionId)
      .eq("user_id", userId)
      .single();

    const update: Record<string, unknown> = { recurrence_group_id: recurrenceGroupId };
    if (tx && !tx.category_id && template?.category_id) {
      update.category_id = template.category_id;
      update.categorization_source = "RECURRING_TEMPLATE";
    }
    // Same backfill rule as the category: only when the tx has none of its own.
    if (tx && !tx.destinatario_id && template?.destinatario_id) {
      update.destinatario_id = template.destinatario_id;
    }

    const { error: txUpdateErr } = await supabase
      .from("transactions")
      .update(update)
      .eq("id", transactionId)
      .eq("user_id", userId);
    if (txUpdateErr) {
      console.error("[markOccurrencePaid] tx group stamp failed:", txUpdateErr.message);
    }
  }

  // Auto-deactivate ONCE templates after their single occurrence is resolved
  const freq = (occurrence?.template as { frequency: string } | null)?.frequency;
  if (freq === "ONCE" && occurrence?.template_id) {
    // Service-role writes skip the encrypted view: its INSTEAD OF UPDATE
    // trigger re-encrypts every column it reads back as NULL without a JWT.
    const { error: deactivateErr } = await supabase
      .from(ctx.isAdmin ? "recurring_transaction_templates_enc" : "recurring_transaction_templates")
      .update({ is_active: false })
      .eq("id", occurrence.template_id)
      .eq("user_id", userId);
    if (deactivateErr) console.error("Failed to deactivate ONCE template:", deactivateErr.message);
  }

  ctx.invalidate();
  return { success: true, data: undefined };
}


/**
 * Find a pending occurrence that matches the given account, date, direction,
 * and amount (within ±1% tolerance). Used by transaction creation paths to
 * auto-link a new transaction to its materialized occurrence.
 * `currencyCode` is the transaction's currency: when it differs from the
 * template's, the amount is converted at the cached daily rate before the
 * tolerance check. Omitted → assumed to be the template's currency.
 * Returns the occurrence ID or null if none found.
 */
export async function findMatchingOccurrenceWith(
  ctx: OccurrenceLinkContext,
  accountId: string,
  transactionDate: string,
  amount: number,
  direction: "INFLOW" | "OUTFLOW",
  destinatarioId: string | null = null,
  currencyCode: string | null = null,
): Promise<string | null> {
  // Direct query — not cached. This runs on mutation paths (tx creation)
  // where fresh data is required to avoid double-linking in batch imports.
  const { supabase, userId } = ctx;

  const baseDateObj = parseISO(transactionDate + "T12:00:00");
  const rangeStart = toColombiaDateString(
    addDays(baseDateObj, -OCCURRENCE_AUTO_LINK_DAY_WINDOW),
  );
  const rangeEnd = toColombiaDateString(
    addDays(baseDateObj, OCCURRENCE_AUTO_LINK_DAY_WINDOW),
  );
  const convert = createAmountConverter(currencyCode);
  const amountMatches = async (
    expectedAmount: number,
    templateCurrency: string | null | undefined,
    anchored: boolean,
  ): Promise<boolean> => {
    const converted = await convert(amount, templateCurrency);
    return converted != null && occurrenceAmountMatches(expectedAmount, converted, anchored);
  };

  // Primary pass: if the transaction has a destinatario, try to match an
  // occurrence whose template is anchored to the same destinatario + account
  // + direction. Stronger signal than amount proximity alone, but a ±50%
  // tolerance still applies — the destinatario link says "this template
  // tracks this merchant", NOT "every tx to this merchant is this payment".
  // A 500k partial payment to a landlord should not silently auto-link to
  // a 2M rent occurrence. The wide band (vs 1% on the amount-only pass)
  // still absorbs realistic variance like fees, exchange rates, or partial
  // extra-principal prepayments. Tolerances live in @zeta/shared
  // (occurrence-matching.ts) so mobile's findAndLinkLocalOccurrence can't
  // drift from this implementation.
  if (destinatarioId) {
    const { data: anchored, error: anchoredError } = await supabase
      .from("recurring_occurrences")
      .select(
        `id, occurrence_date, expected_amount,
         template:recurring_transaction_templates!recurring_occurrences_template_id_fkey!inner(
           account_id, destinatario_id, direction, is_active, currency_code
         )`
      )
      .eq("user_id", userId)
      .eq("status", "pending")
      .eq("template.account_id", accountId)
      .eq("template.destinatario_id", destinatarioId)
      .eq("template.direction", direction)
      .eq("template.is_active", true)
      .gte("occurrence_date", rangeStart)
      .lte("occurrence_date", rangeEnd)
      .order("occurrence_date", { ascending: true });

    if (anchoredError) {
      // Log but don't abort — fall through to the amount-proximity pass so
      // a transient DB hiccup doesn't block legitimate matches.
      console.error("[findMatchingOccurrence] anchored query failed", anchoredError);
    }

    const anchoredRows = anchored ?? [];
    const anchoredHits = await Promise.all(
      anchoredRows.map((row) =>
        amountMatches(row.expected_amount, row.template?.currency_code, true),
      ),
    );
    const anchoredWithinTolerance = anchoredRows.filter((_, i) => anchoredHits[i]);

    if (anchoredWithinTolerance.length > 0) {
      // parseISO both sides for timezone consistency — baseDateObj was parsed
      // with an explicit noon offset, while occurrence_date is a bare YYYY-MM-DD
      // which `new Date()` would interpret as UTC midnight (off by hours in Colombia).
      const nearest = anchoredWithinTolerance.reduce((best, row) => {
        const bestDiff = Math.abs(
          parseISO(best.occurrence_date + "T12:00:00").getTime() - baseDateObj.getTime(),
        );
        const rowDiff = Math.abs(
          parseISO(row.occurrence_date + "T12:00:00").getTime() - baseDateObj.getTime(),
        );
        return rowDiff < bestDiff ? row : best;
      }, anchoredWithinTolerance[0]);
      return nearest.id;
    }
  }

  const { data, error } = await supabase
    .from("recurring_occurrences")
    .select(
      `id, expected_amount,
       template:recurring_transaction_templates!recurring_occurrences_template_id_fkey!inner(
         account_id, direction, is_active, currency_code
       )`
    )
    .eq("user_id", userId)
    .eq("status", "pending")
    .eq("template.account_id", accountId)
    .eq("template.direction", direction)
    .eq("template.is_active", true)
    .gte("occurrence_date", rangeStart)
    .lte("occurrence_date", rangeEnd);

  if (error || !data) return null;

  const directHits = await Promise.all(
    data.map((row) =>
      amountMatches(row.expected_amount, row.template?.currency_code, false),
    ),
  );
  const match = data.find((_, i) => directHits[i]);
  if (match) return match.id;

  // Secondary query: cross-account debt payment matching.
  // If this is an OUTFLOW from a source account, check if a debt payment template
  // has transfer_source_account_id pointing here.
  if (direction === "OUTFLOW") {
    const { data: crossData, error: crossErr } = await supabase
      .from("recurring_occurrences")
      .select(
        `id, expected_amount,
         template:recurring_transaction_templates!recurring_occurrences_template_id_fkey!inner(
           account_id, transfer_source_account_id, direction, is_active, currency_code,
           account:accounts!recurring_transaction_templates_account_id_fkey(account_type)
         )`
      )
      .eq("user_id", userId)
      .eq("status", "pending")
      .eq("template.transfer_source_account_id", accountId)
      .eq("template.direction", "INFLOW")
      .eq("template.is_active", true)
      .gte("occurrence_date", rangeStart)
      .lte("occurrence_date", rangeEnd);

    if (!crossErr && crossData) {
      const crossHits = await Promise.all(
        crossData.map((row) =>
          amountMatches(row.expected_amount, row.template?.currency_code, false),
        ),
      );
      const crossMatch = crossData.find((row, i) => {
        const t = row.template as TemplateWithAccount | null;
        return (
          crossHits[i] &&
          t != null && isCrossAccountDebtPayment(t, direction, accountId)
        );
      });
      if (crossMatch) return crossMatch.id;
    }
  }

  return null;
}

/**
 * Convenience: find a matching pending occurrence and mark it paid.
 * Used by all transaction creation paths (FAB, email, PDF import).
 *
 * Also handles the "phantom-swap" race: if no PENDING occurrence matches but
 * a recently-paid system-created occurrence does (i.e. the user clicked
 * "Confirmar pago" before the bank-verified import arrived), the imported
 * transaction supersedes the phantom — the phantom tx is deleted (balance
 * reversed) and the occurrence is repointed at the imported transaction.
 */
export async function linkTransactionToOccurrenceWith(
  ctx: OccurrenceLinkContext,
  accountId: string,
  transactionDate: string,
  amount: number,
  direction: "INFLOW" | "OUTFLOW",
  transactionId: string,
  destinatarioId: string | null = null,
  options: {
    skipDebtCompanionLeg?: boolean;
    currencyCode?: string | null;
    /** Plaintext label for a debt companion leg when the template's name can't be decrypted. */
    labelHint?: string | null;
  } = {},
): Promise<void> {
  const matchId = await findMatchingOccurrenceWith(
    ctx,
    accountId,
    transactionDate,
    amount,
    direction,
    destinatarioId,
    options.currencyCode ?? null,
  );
  if (matchId) {
    await markOccurrencePaidWith(ctx, matchId, transactionId);
    // A debt-payment occurrence paid from another account (e.g. an email-
    // captured transfer) only registers the source OUTFLOW — without the
    // companion INFLOW the debt account's balance never moves. Statement
    // imports opt out: the card statement carries its own abono row.
    if (!options.skipDebtCompanionLeg) {
      await ensureDebtCompanionLeg(ctx, {
        occurrenceId: matchId,
        sourceTransactionId: transactionId,
        sourceAccountId: accountId,
        transactionDate,
        amount,
        direction,
        currencyCode: options.currencyCode ?? null,
        labelHint: options.labelHint ?? null,
      });
    }
    return;
  }

  await swapPhantomOccurrenceIfMatched(
    ctx,
    accountId,
    transactionDate,
    amount,
    direction,
    transactionId,
    options.currencyCode ?? null,
  );
}

/**
 * Create the companion INFLOW on the debt account when a payment occurrence
 * is auto-linked to an OUTFLOW from another account (email ingest, manual
 * form). Mirrors leg B of the recurring-checklist flow: idempotent (key
 * derived from the source transaction), tier-3 capture, balances synced via
 * applyDebtPaymentToBalances. No-op for non-debt templates or same-account
 * payments.
 */
async function ensureDebtCompanionLeg(
  ctx: OccurrenceLinkContext,
  params: {
    occurrenceId: string;
    sourceTransactionId: string;
    sourceAccountId: string;
    transactionDate: string;
    amount: number;
    direction: "INFLOW" | "OUTFLOW";
    currencyCode?: string | null;
    labelHint?: string | null;
  },
): Promise<void> {
  if (params.direction !== "OUTFLOW" || params.amount <= 0) return;

  const { supabase, userId } = ctx;

  try {
    const { data: occurrence } = await supabase
      .from("recurring_occurrences")
      .select(
        `id,
         template:recurring_transaction_templates!recurring_occurrences_template_id_fkey!inner(
           id, account_id, currency_code, merchant_name, description, category_id
         )`
      )
      .eq("id", params.occurrenceId)
      .eq("user_id", userId)
      .single();

    const template = occurrence?.template as {
      id: string;
      account_id: string;
      currency_code: import("@/types/domain").CurrencyCode;
      merchant_name: string | null;
      description: string | null;
      category_id: string | null;
    } | null;
    if (!template || template.account_id === params.sourceAccountId) return;
    // The companion leg books `amount` in the template's currency; a payment
    // in another currency would land on the debt with the wrong magnitude.
    if (params.currencyCode && params.currencyCode !== template.currency_code) return;

    const [{ data: debtAccount }, { data: sourceAccount }, { data: sourceTx }] =
      await Promise.all([
        supabase
          .from("accounts")
          .select("id, name, account_type")
          .eq("user_id", userId)
          .eq("id", template.account_id)
          .single(),
        supabase
          .from("accounts")
          .select("id, name")
          .eq("user_id", userId)
          .eq("id", params.sourceAccountId)
          .single(),
        supabase
          .from("transactions")
          .select("recurrence_group_id")
          .eq("user_id", userId)
          .eq("id", params.sourceTransactionId)
          .single(),
      ]);

    if (!debtAccount || !isDebtAccountType(debtAccount.account_type)) return;

    // Under the service-role client the encrypted names read back as NULL;
    // the caller's plaintext hint (e.g. the parsed email merchant) fills in.
    const label =
      template.merchant_name || template.description || params.labelHint || "Pago recurrente";
    const rawDescription = `Abono deuda desde ${sourceAccount?.name ?? "cuenta"} - ${label}`;

    // Stable per source transaction: re-linking or retries hit 23505 → skip.
    const idempotencyKey = await computeIdempotencyKey({
      provider: "DEBT_COMPANION_LEG",
      providerTransactionId: params.sourceTransactionId,
      transactionDate: params.transactionDate,
      amount: params.amount,
      rawDescription,
    });

    const { error: insertError } = await supabase.from("transactions").insert({
      user_id: userId,
      account_id: template.account_id,
      amount: params.amount,
      currency_code: template.currency_code,
      direction: "INFLOW",
      transaction_date: params.transactionDate,
      raw_description: rawDescription,
      clean_description: label,
      merchant_name: label,
      category_id:
        template.category_id ?? getDebtPaymentCategoryId(debtAccount.account_type),
      notes: "Abono de deuda generado automáticamente al vincular el pago",
      idempotency_key: idempotencyKey,
      provider: "MANUAL",
      status: "POSTED",
      capture_method: "MANUAL_FORM",
      is_recurring: true,
      recurrence_group_id: sourceTx?.recurrence_group_id ?? null,
      categorization_source: template.category_id ? "USER_CREATED" : "SYSTEM_DEFAULT",
      // DEBT_CREDIT structurally: the guard above already established that
      // template.account_id is a card or a loan.
      ...flowClassColumns({
        direction: "INFLOW",
        accountType: debtAccount.account_type,
        description: label,
      }),
    });

    if (insertError) {
      if (insertError.code !== "23505") {
        console.error("[ensureDebtCompanionLeg] insert failed", insertError.message);
      }
      return;
    }

    await applyDebtPaymentToBalances({
      supabase,
      userId,
      accountId: template.account_id,
      amount: params.amount,
      currencyCode: template.currency_code,
      serviceRole: ctx.isAdmin,
    });
  } catch (error) {
    // Linking must never fail the primary transaction insert.
    console.error("[ensureDebtCompanionLeg] failed", error);
  }
}

/**
 * Phantom-swap fallback for `linkTransactionToOccurrence`.
 *
 * If a recently-paid, system-created (linked_manually=false) occurrence exists
 * in the same account/direction window with a matching amount, replace its
 * phantom transaction with the just-inserted bank-verified one.
 *
 * Restricted to single-tx recurrence groups — multi-leg debt-payment phantoms
 * (CC inflow + source outflow) require human reconciliation.
 */
async function swapPhantomOccurrenceIfMatched(
  ctx: OccurrenceLinkContext,
  accountId: string,
  transactionDate: string,
  amount: number,
  direction: "INFLOW" | "OUTFLOW",
  newTransactionId: string,
  currencyCode: string | null = null,
): Promise<void> {
  const { supabase, userId } = ctx;

  const baseDateObj = parseISO(transactionDate + "T12:00:00");
  const rangeStart = toColombiaDateString(
    addDays(baseDateObj, -OCCURRENCE_AUTO_LINK_DAY_WINDOW),
  );
  const rangeEnd = toColombiaDateString(
    addDays(baseDateObj, OCCURRENCE_AUTO_LINK_DAY_WINDOW),
  );

  const { data: candidates, error } = await supabase
    .from("recurring_occurrences")
    .select(
      `id, transaction_id, expected_amount,
       template:recurring_transaction_templates!recurring_occurrences_template_id_fkey!inner(
         account_id, direction, is_active, currency_code
       )`,
    )
    .eq("user_id", userId)
    .eq("status", "paid")
    .eq("linked_manually", false)
    .eq("template.account_id", accountId)
    .eq("template.direction", direction)
    .eq("template.is_active", true)
    .gte("occurrence_date", rangeStart)
    .lte("occurrence_date", rangeEnd);

  if (error || !candidates) return;

  const match = candidates.find(
    (row) =>
      row.transaction_id != null &&
      // The swap deletes the phantom tx — never on a cross-currency guess.
      (!currencyCode || row.template?.currency_code === currencyCode) &&
      occurrenceAmountMatches(row.expected_amount, amount, false),
  );
  if (!match || !match.transaction_id) return;

  // Read phantom tx — must be a single-tx recurrence group to swap safely
  const { data: phantomTx } = await supabase
    .from("transactions")
    .select(
      "id, recurrence_group_id, amount, direction, account_id, accounts!transactions_account_id_fkey(account_type, current_balance)",
    )
    .eq("id", match.transaction_id)
    .eq("user_id", userId)
    .single();

  if (!phantomTx || !phantomTx.recurrence_group_id) return;

  const { data: groupTxs } = await supabase
    .from("transactions")
    .select("id")
    .eq("recurrence_group_id", phantomTx.recurrence_group_id)
    .eq("user_id", userId);

  if (!groupTxs || groupTxs.length !== 1) {
    // Multi-leg phantom (e.g. source OUTFLOW + debt companion INFLOW from
    // ensureDebtCompanionLeg) — a later bank-verified import of either leg
    // intentionally falls through to manual reconciliation instead of an
    // automatic swap.
    return;
  }

  // Order: delete phantom first, then reverse balance. If the delete fails the
  // balance is still correct; if the balance update fails after a successful
  // delete, the account will be off by the phantom amount but the row is gone —
  // recoverable via "recompute account balance". Without ACID transactions across
  // PostgREST calls, this ordering minimizes the window of inconsistency.
  const phantomAccount = phantomTx.accounts as
    | { account_type: string; current_balance: number }
    | null;

  const { error: delErr } = await supabase
    .from("transactions")
    .delete()
    .eq("id", phantomTx.id)
    .eq("user_id", userId);
  if (delErr) {
    console.error("[swapPhantomOccurrence] phantom delete failed:", delErr.message);
    return;
  }

  if (phantomAccount) {
    const reversedBalance = reverseAccountBalanceDelta({
      currentBalance: phantomAccount.current_balance,
      accountType: phantomAccount.account_type,
      direction: phantomTx.direction as "INFLOW" | "OUTFLOW",
      amount: phantomTx.amount,
    });
    const { error: balErr } = await supabase
      .from("accounts")
      .update({ current_balance: reversedBalance })
      .eq("id", phantomTx.account_id)
      .eq("user_id", userId);
    if (balErr) {
      console.error("[swapPhantomOccurrence] balance reverse failed after delete:", balErr.message);
      // Continue — phantom is gone, repoint the occurrence anyway so the user
      // sees the import as the canonical payment. Account balance can be
      // recomputed; leaving the orphan paid occurrence is worse UX.
    }
  }

  // Repoint the occurrence at the new tx, mark linked_manually so future
  // reverts unlink (don't delete) the bank-verified transaction.
  const { error: occErr } = await supabase
    .from("recurring_occurrences")
    .update({
      transaction_id: newTransactionId,
      linked_manually: true,
      paid_at: new Date().toISOString(),
    })
    .eq("id", match.id)
    .eq("user_id", userId);
  if (occErr) {
    console.error("[swapPhantomOccurrence] occurrence repoint failed:", occErr.message);
  }

  // Stamp the new tx with the existing recurrence_group_id so the Vincular
  // button hides and downstream queries treat it as the canonical payment.
  const { error: txStampErr } = await supabase
    .from("transactions")
    .update({ recurrence_group_id: phantomTx.recurrence_group_id })
    .eq("id", newTransactionId)
    .eq("user_id", userId);
  if (txStampErr) {
    console.error("[swapPhantomOccurrence] new tx group stamp failed:", txStampErr.message);
  }

  ctx.invalidate();
}
