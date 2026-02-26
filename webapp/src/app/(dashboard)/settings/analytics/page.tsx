import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type DailyEventCountRow = {
  day: string;
  event_name: string;
  flow: string;
  event_count: number;
  user_count: number;
};

type ActivationRow = {
  cohort_day: string;
  signups: number;
  activated_d7: number;
  activation_d7_pct: number;
};

type ImportFunnelRow = {
  day: string;
  sessions: number;
  opened: number;
  file_selected: number;
  parse_requested: number;
  parse_succeeded: number;
  confirm_submitted: number;
  completed: number;
  open_to_complete_pct: number;
};

type CategorizationFunnelRow = {
  day: string;
  users_with_activity: number;
  seen: number;
  picker_opened: number;
  selected: number;
  categorized: number;
  bulk_categorized: number;
  seen_to_categorized_pct: number;
};

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const db = supabase as unknown as {
    schema: (name: string) => {
      from: (table: string) => {
        select: (query: string) => {
          order: (column: string, options?: { ascending?: boolean }) => {
            limit: (count: number) => Promise<{ data: unknown[] | null }>;
          };
        };
      };
    };
  };

  const [dailyCountsRes, activationRes, importRes, categorizeRes] = await Promise.all([
    db
      .schema("analytics")
      .from("product_event_daily_counts")
      .select("day,event_name,flow,event_count,user_count")
      .order("day", { ascending: false })
      .limit(50),
    db
      .schema("analytics")
      .from("activation_d7")
      .select("cohort_day,signups,activated_d7,activation_d7_pct")
      .order("cohort_day", { ascending: false })
      .limit(30),
    db
      .schema("analytics")
      .from("import_funnel_daily")
      .select(
        "day,sessions,opened,file_selected,parse_requested,parse_succeeded,confirm_submitted,completed,open_to_complete_pct"
      )
      .order("day", { ascending: false })
      .limit(30),
    db
      .schema("analytics")
      .from("categorization_funnel_daily")
      .select(
        "day,users_with_activity,seen,picker_opened,selected,categorized,bulk_categorized,seen_to_categorized_pct"
      )
      .order("day", { ascending: false })
      .limit(30),
  ]);

  const dailyCounts = (dailyCountsRes.data ?? []) as DailyEventCountRow[];
  const activation = (activationRes.data ?? []) as ActivationRow[];
  const importFunnel = (importRes.data ?? []) as ImportFunnelRow[];
  const categorizeFunnel = (categorizeRes.data ?? []) as CategorizationFunnelRow[];

  const latestImport = importFunnel[0];
  const latestCategorize = categorizeFunnel[0];
  const latestActivation = activation[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics Interno</h1>
        <p className="text-muted-foreground">
          Seguimiento operativo de funnels F1/F2/F3 para rediseño UI/UX.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Activation D7 (último cohort)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {latestActivation ? `${latestActivation.activation_d7_pct}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {latestActivation
                ? `${latestActivation.activated_d7}/${latestActivation.signups} usuarios activados`
                : "Sin datos aún"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Import Open → Complete</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {latestImport ? `${latestImport.open_to_complete_pct}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {latestImport
                ? `${latestImport.completed}/${latestImport.opened} sesiones`
                : "Sin datos aún"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Seen → Categorized</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {latestCategorize ? `${latestCategorize.seen_to_categorized_pct}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {latestCategorize
                ? `${latestCategorize.categorized}/${latestCategorize.seen} usuarios`
                : "Sin datos aún"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Funnel de Importación (diario)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {importFunnel.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
          ) : (
            importFunnel.slice(0, 10).map((row) => (
              <div
                key={row.day}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
              >
                <span className="font-medium">{row.day}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">open {row.opened}</Badge>
                  <Badge variant="secondary">parse ok {row.parse_succeeded}</Badge>
                  <Badge variant="secondary">complete {row.completed}</Badge>
                  <Badge>{row.open_to_complete_pct}%</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Funnel de Categorización (diario)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {categorizeFunnel.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
          ) : (
            categorizeFunnel.slice(0, 10).map((row) => (
              <div
                key={row.day}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
              >
                <span className="font-medium">{row.day}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">seen {row.seen}</Badge>
                  <Badge variant="secondary">selected {row.selected}</Badge>
                  <Badge variant="secondary">categorized {row.categorized}</Badge>
                  <Badge>{row.seen_to_categorized_pct}%</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eventos recientes (agregado diario)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {dailyCounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
          ) : (
            dailyCounts.slice(0, 20).map((row, idx) => (
              <div
                key={`${row.day}-${row.event_name}-${idx}`}
                className="flex items-center justify-between rounded-md border p-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{row.day}</Badge>
                  <span>{row.event_name}</span>
                  <span className="text-xs text-muted-foreground">({row.flow})</span>
                </div>
                <div className="text-muted-foreground">
                  {row.event_count} eventos · {row.user_count} usuarios
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

