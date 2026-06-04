import { Redirect } from "expo-router";

/**
 * Manual full transaction form route.
 *
 * The dedicated full-form screen is not built yet (Phase 3 webapp parity). Until
 * it lands, redirect to the working quick-capture screen so this route is never a
 * dead end — `/capture` already supports expense/income with account, category,
 * destinatario, notes and recurring-template creation.
 *
 * TODO(parity): build the full MobileTransactionForm here and make `/capture`
 * honor an optional `?account` / `?type` preset so account-detail "Agregar"
 * pre-selects the originating account.
 */
export default function NewTransactionScreen() {
  return <Redirect href="/capture" />;
}
