export type AttentionPriority = "action" | "suggestion";

export type AttentionSignal = {
  page: string;
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
  perPage: Record<string, number>;
};
