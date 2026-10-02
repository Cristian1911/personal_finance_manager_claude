import type { InicioAccount } from "./inicio";
import type { StoredTransaction } from "./movements";
import { movementTime, readableName, shortDate, signedPesos } from "./view";
import { colombiaTime } from "./widgets";

/** A bank movement held because it may be one you anotaste (S1-2: never resolved alone). */
export interface PosibleDuplicado {
  id: string;
  /** "¿Es el mismo que anotaste?" — both sides, as the user wrote / the bank said them. */
  banco: { title: string; amount: string; date: string; account: string };
  tuyo: { title: string; amount: string; date: string };
}

/** Revisar's possible duplicates, newest first. */
export function posiblesDuplicados(
  transactions: StoredTransaction[],
  accounts: Pick<InicioAccount, "id" | "name">[],
): PosibleDuplicado[] {
  const byId = new Map(transactions.map((t) => [t.id, t]));
  const label = new Map(accounts.map((a) => [a.id, a.name?.trim() || "Cuenta"]));
  const side = (t: StoredTransaction) => ({
    title: readableName(t.description?.trim() || "Movimiento"),
    amount: signedPesos(t.direction === "OUTFLOW" ? -t.amount : t.amount),
    // The time helps tell them apart (3:26 at the bank vs 3:25 anotado).
    date: [shortDate(t.date), movementTime(t, colombiaTime)].filter(Boolean).join(" · "),
  });
  return transactions
    .filter((t) => t.status === "PENDING" && t.reconciledIntoTransactionId)
    .flatMap((t) => {
      const twin = byId.get(t.reconciledIntoTransactionId!);
      return twin ? [{ id: t.id, banco: { ...side(t), account: label.get(t.accountId) ?? "Cuenta" }, tuyo: side(twin) }] : [];
    })
    .sort((a, b) => (byId.get(b.id)!.date < byId.get(a.id)!.date ? -1 : 1));
}
