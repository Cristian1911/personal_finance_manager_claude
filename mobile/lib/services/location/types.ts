/**
 * Shared shapes for the location pipeline.
 *
 * `LocationPing` is a transient row in the local-only `location_pings` table.
 * `TransactionLocationRow` mirrors the `transaction_locations` table (synced
 * to Supabase as `transaction_locations` view).
 */

export type LocationPing = {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  captured_at: string;
  consumed: number;
};

export type TransactionLocationRow = {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  place_name: string | null;
  place_locality: string | null;
  place_country: string | null;
  captured_at: string;
  linked_transaction_id: string | null;
  created_at: string;
  updated_at: string;
};

export const ZETA_LOCATION_TASK = "zeta-background-location-task" as const;
