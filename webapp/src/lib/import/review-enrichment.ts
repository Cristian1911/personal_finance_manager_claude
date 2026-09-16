import type { ActiveModo } from "@/types/domain";

/**
 * Per-row decisions taken in the import review step before anything is
 * inserted: trip/event, "compartido con…", free tags and a note. Pure helpers
 * so the defaults and the triage filters are unit-testable.
 */
export type RowShareParticipant = { destinatario_id: string; name: string; value?: number };

export type RowShare = {
  method: "equal" | "percent";
  userIncluded: boolean;
  participants: RowShareParticipant[];
  /** "modo" = preset "Personas del viaje"; "custom" = picked by hand. */
  source: "modo" | "custom";
};

export type RowEnrichment = {
  modoId: string | null;
  tagIds: string[];
  notes: string;
  share: RowShare | null;
};

export const EMPTY_ENRICHMENT: RowEnrichment = { modoId: null, tagIds: [], notes: "", share: null };

export type EnrichmentRowInput = {
  date: string;
  direction: "INFLOW" | "OUTFLOW";
  installment_current: number | null | undefined;
};

/** The active trip is only a default for spend inside its dates; cuotas are never auto-filed (same rule as the tray). */
export function defaultModoFor(row: EnrichmentRowInput, activeModo: ActiveModo | null | undefined): string | null {
  if (!activeModo) return null;
  if (row.direction !== "OUTFLOW") return null;
  if (row.installment_current != null) return null;
  if (row.date < activeModo.date_from || row.date > activeModo.date_to) return null;
  return activeModo.id;
}

/** Explicit decisions win; otherwise only the active-trip default is filled in. */
export function effectiveEnrichment(
  explicit: RowEnrichment | undefined,
  row: EnrichmentRowInput,
  activeModo: ActiveModo | null | undefined,
): RowEnrichment {
  if (explicit) return explicit;
  const modoId = defaultModoFor(row, activeModo);
  return modoId ? { ...EMPTY_ENRICHMENT, modoId } : EMPTY_ENRICHMENT;
}

export type ReviewFilter = "all" | "uncategorized" | "installments" | "newMerchants" | "trip";

export const REVIEW_FILTER_LABELS: Record<ReviewFilter, string> = {
  all: "Todas",
  uncategorized: "Sin categoría",
  installments: "Cuotas",
  newMerchants: "Comercios nuevos",
  trip: "Del viaje",
};

export type ReviewRowFacts = {
  hasCategory: boolean;
  isInstallment: boolean;
  hasDestinatario: boolean;
  modoId: string | null;
};

export function matchesReviewFilter(filter: ReviewFilter, facts: ReviewRowFacts): boolean {
  switch (filter) {
    case "all":
      return true;
    case "uncategorized":
      return !facts.hasCategory;
    case "installments":
      return facts.isInstallment;
    case "newMerchants":
      return !facts.hasDestinatario;
    case "trip":
      return facts.modoId != null;
  }
}

/** One-line summary of a share config for chips and badges. */
export function describeRowShare(share: RowShare | null): string | null {
  if (!share || share.participants.length === 0) return null;
  const names = share.participants.map((p) => p.name).filter(Boolean);
  const who = names.length <= 2 ? names.join(" y ") : `${names[0]} y ${names.length - 1} más`;
  return `${who} · ${share.method === "equal" ? "partes iguales" : "porcentaje"}`;
}
