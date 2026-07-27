export type AttentionPriority = "action" | "suggestion";

export type AttentionPage =
  | "transactions"
  | "categories"
  | "destinatarios"
  | "recurrentes"
  | "pendientes"
  | "deudas-personales";

export type AttentionSignal = {
  page: AttentionPage;
  key: string;
  count: number;
  label: string;
  priority: AttentionPriority;
  actionHref: string;
};

export type AttentionSnapshot = {
  signals: AttentionSignal[];
  totalAction: number;
  totalSuggestion: number;
  perPage: Partial<Record<AttentionPage, number>>;
};
