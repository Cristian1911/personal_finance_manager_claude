export type SnapshotDiff = {
  field: string;
  previousValue: number | string | null;
  currentValue: number | string | null;
  changeType: "increased" | "decreased" | "changed" | "new";
};

type SnapshotLike = Record<string, number | string | null | undefined>;

const TRACKED_FIELDS: { key: string; label: string }[] = [
  { key: "credit_limit", label: "Cupo total" },
  { key: "available_credit", label: "Cupo disponible" },
  { key: "interest_rate", label: "Tasa de interes" },
  { key: "total_payment_due", label: "Total a pagar" },
  { key: "minimum_payment", label: "Pago minimo" },
  { key: "final_balance", label: "Saldo final" },
  { key: "interest_charged", label: "Intereses cobrados" },
  { key: "purchases_and_charges", label: "Compras y cargos" },
  { key: "previous_balance", label: "Saldo anterior" },
  { key: "total_credits", label: "Total abonos" },
  { key: "total_debits", label: "Total cargos" },
  { key: "remaining_balance", label: "Saldo capital" },
  { key: "initial_amount", label: "Monto inicial" },
  { key: "installments_in_default", label: "Cuotas en mora" },
];

export function computeSnapshotDiffs(
  previous: SnapshotLike | null,
  current: SnapshotLike
): SnapshotDiff[] {
  const diffs: SnapshotDiff[] = [];

  for (const { key, label } of TRACKED_FIELDS) {
    const prev = previous?.[key] ?? null;
    const curr = current[key] ?? null;

    if (curr === null || curr === undefined) continue;
    if (prev === null || prev === undefined) {
      diffs.push({
        field: label,
        previousValue: null,
        currentValue: curr,
        changeType: "new",
      });
      continue;
    }
    if (prev !== curr) {
      let changeType: SnapshotDiff["changeType"] = "changed";
      if (typeof prev === "number" && typeof curr === "number") {
        changeType = curr > prev ? "increased" : "decreased";
      }
      diffs.push({
        field: label,
        previousValue: prev,
        currentValue: curr,
        changeType,
      });
    }
  }

  return diffs;
}
