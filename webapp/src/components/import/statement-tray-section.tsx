import { getStatementTray } from "@/actions/statement-tray";
import { StatementTrayPanel } from "./statement-tray-panel";

/** Server wrapper so the tray streams in under Suspense on the import page. */
export async function StatementTraySection() {
  const result = await getStatementTray();
  if (!result.success || result.data.rows.length === 0) return null;
  return <StatementTrayPanel rows={result.data.rows} truncated={result.data.truncated} />;
}
