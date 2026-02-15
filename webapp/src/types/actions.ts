export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export type PaginatedResult<T> = {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
