import { getDatabase } from "../db/database";

export type DestinatarioRow = {
  id: string;
  user_id: string;
  name: string;
  name_hmac: string | null;
  default_category_id: string | null;
  notes: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

export type DestinatarioRuleRow = {
  id: string;
  user_id: string;
  destinatario_id: string;
  pattern: string;
  match_type: string;
  priority: number;
  match_count: number;
  last_matched_at: string | null;
  created_at: string;
};

/** Destinatario with its transaction count */
export type DestinatarioWithCount = DestinatarioRow & {
  transaction_count: number;
  category_name: string | null;
};

export async function getAllDestinatarios(): Promise<DestinatarioWithCount[]> {
  const db = await getDatabase();
  return db.getAllAsync<DestinatarioWithCount>(
    `SELECT
      d.*,
      COALESCE(c.name_es, c.name) AS category_name,
      (SELECT COUNT(*) FROM transactions t WHERE t.destinatario_id = d.id) AS transaction_count
    FROM destinatarios d
    LEFT JOIN categories c ON d.default_category_id = c.id
    WHERE d.is_active = 1
    ORDER BY d.name ASC`
  );
}

export async function getDestinatarioById(
  id: string
): Promise<DestinatarioWithCount | null> {
  const db = await getDatabase();
  return db.getFirstAsync<DestinatarioWithCount>(
    `SELECT
      d.*,
      COALESCE(c.name_es, c.name) AS category_name,
      (SELECT COUNT(*) FROM transactions t WHERE t.destinatario_id = d.id) AS transaction_count
    FROM destinatarios d
    LEFT JOIN categories c ON d.default_category_id = c.id
    WHERE d.id = ?`,
    [id]
  );
}

export async function getRulesForDestinatario(
  destinatarioId: string
): Promise<DestinatarioRuleRow[]> {
  const db = await getDatabase();
  return db.getAllAsync<DestinatarioRuleRow>(
    `SELECT * FROM destinatario_rules
     WHERE destinatario_id = ?
     ORDER BY priority DESC`,
    [destinatarioId]
  );
}
