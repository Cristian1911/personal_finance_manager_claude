import { inferPersonalDebtRole } from "@zeta/shared";
import type {
  PersonDebtItem,
  PersonDebtSummary,
} from "@/lib/personal-debts/hierarchy";

/**
 * What a movement can be linked to, read off the persona → viaje → deudas
 * hierarchy: the person as a whole, one of their viajes, or one debt. Pure so
 * the picker and the tests share one rule.
 *
 * Only abonos spread (person / viaje scope): a movement going the debt's own
 * way is a new loan and joins exactly one debt.
 */

/** What a debt was for: the origin movement, else its note, else a default. */
export function describeDebtItem(item: PersonDebtItem, hideNote?: string | null): string {
  const o = item.origin;
  const fromTx = o?.merchant_name || o?.clean_description || o?.raw_description;
  if (fromTx) return fromTx;
  const note = item.notes?.trim();
  if (note && note.toLowerCase() !== hideNote?.trim().toLowerCase()) return note;
  return item.direction === "borrowed" ? "Préstamo recibido" : "Préstamo";
}

export type LinkTx = {
  amount: number;
  currency_code: string;
  direction: "INFLOW" | "OUTFLOW";
};

export type LinkDebtOption = {
  id: string;
  item: PersonDebtItem;
  role: "origin" | "repayment";
  /** Part of a shared payment (its origin is the split transaction). */
  shared: boolean;
};

export type LinkScopeOption = {
  key: string;
  kind: "persona" | "viaje";
  label: string;
  emoji: string | null;
  /** Repayable debts in scope, oldest-first order is decided server-side. */
  debtIds: string[];
  pending: number;
  /** The movement is bigger than what is pending in scope. */
  exceeds: boolean;
};

export type LinkDebtSection = {
  key: string;
  title: string;
  emoji: string | null;
  debts: LinkDebtOption[];
};

export type LinkPersonOption = {
  destinatario_id: string;
  name: string;
  /** Pending you could abonar with this movement (same currency + direction). */
  pending: number;
  /** "persona" first (when ≥2 debts), then each viaje with ≥2 debts. */
  scopes: LinkScopeOption[];
  sections: LinkDebtSection[];
};

function debtOption(item: PersonDebtItem, tx: LinkTx): LinkDebtOption | null {
  if (item.status !== "active" || item.currency_code !== tx.currency_code) return null;
  const role = inferPersonalDebtRole(item.direction, tx.direction);
  // A shared-payment debt's origin is the split transaction itself.
  if (role === "origin" && item.split_group_id) return null;
  return { id: item.id, item, role, shared: !!item.split_group_id };
}

function repayable(options: LinkDebtOption[]): LinkDebtOption[] {
  return options.filter((o) => o.role === "repayment" && Number(o.item.outstanding_amount) > 0);
}

function scopeOf(
  key: string,
  kind: "persona" | "viaje",
  label: string,
  emoji: string | null,
  options: LinkDebtOption[],
  tx: LinkTx,
): LinkScopeOption | null {
  const r = repayable(options);
  if (r.length < 2) return null;
  const pending = r.reduce((s, o) => s + Number(o.item.outstanding_amount), 0);
  return { key, kind, label, emoji, debtIds: r.map((o) => o.id), pending, exceeds: tx.amount > pending + 1e-9 };
}

export function buildLinkOptions(people: PersonDebtSummary[], tx: LinkTx): LinkPersonOption[] {
  const out: LinkPersonOption[] = [];
  for (const p of people) {
    const sections: LinkDebtSection[] = [];
    const tripScopes: LinkScopeOption[] = [];
    for (const g of p.groups) {
      const debts = g.items.map((i) => debtOption(i, tx)).filter((x): x is LinkDebtOption => !!x);
      if (debts.length === 0) continue;
      sections.push({ key: g.key, title: g.modo.name, emoji: g.modo.emoji, debts });
      const scope = scopeOf(`viaje|${g.key}`, "viaje", g.modo.name, g.modo.emoji, debts, tx);
      if (scope) tripScopes.push(scope);
    }
    const loose = p.loose.map((i) => debtOption(i, tx)).filter((x): x is LinkDebtOption => !!x);
    if (loose.length > 0) {
      sections.push({ key: "sueltas", title: sections.length > 0 ? "Otras deudas" : "Deudas", emoji: null, debts: loose });
    }
    if (sections.length === 0) continue;

    const all = sections.flatMap((s) => s.debts);
    const personScope = scopeOf(`persona|${p.destinatario_id}`, "persona", p.name, null, all, tx);
    // A viaje that holds every repayable debt says the same as "a todo".
    const trips = personScope
      ? tripScopes.filter((t) => t.debtIds.length < personScope.debtIds.length)
      : tripScopes;
    out.push({
      destinatario_id: p.destinatario_id,
      name: p.name,
      pending: repayable(all).reduce((s, o) => s + Number(o.item.outstanding_amount), 0),
      scopes: personScope ? [personScope, ...trips] : trips,
      sections,
    });
  }
  // People you can abonar to first, biggest pending first; then the rest.
  return out.sort((a, b) => b.pending - a.pending || a.name.localeCompare(b.name, "es"));
}
