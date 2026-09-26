/**
 * Offline eval: can a typed decision model (TypeSafe Jev) suggest categories
 * for Zeta transactions better than the deterministic engine?
 *
 * Data never lives in the repo. Export it with `extract.sql` (Supabase MCP or
 * psql) into $JEV_EVAL_DIR as `data.tsv` + `cats.json`, then:
 *
 *   JEV_EVAL_DIR=/path/to/dir npx -y tsx scripts/jev-eval/eval.ts
 *
 * Jev runs only when TYPESAFE_API_KEY is set and `jev-client.ts` is
 * implemented against the official API reference.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { autoCategorize } from "../../packages/shared/src/utils/auto-categorize";
import { cleanDescription } from "../../packages/shared/src/utils/destinatario-matcher";
import { jevChoice, jevAvailable } from "./jev-client";

type Row = {
  descr: string;
  label: string;
  dir: string;
  acct: string;
  n: number;
  first: string;
  src: string;
};

type Prediction = { label: string | null; confidence: number; top: string[] };

const DIR = process.env.JEV_EVAL_DIR;
if (!DIR) throw new Error("Set JEV_EVAL_DIR to the folder holding data.tsv + cats.json");
const SPLIT_DATE = process.env.JEV_EVAL_SPLIT ?? "2026-08-01";

const cats: Record<string, string> = JSON.parse(readFileSync(join(DIR, "cats.json"), "utf8"));
const labels = [...new Set(Object.values(cats))].sort();
const rows: Row[] = readFileSync(join(DIR, "data.tsv"), "utf8")
  .trim()
  .split("\n")
  .slice(1)
  .map((line) => {
    const [descr, label, dir, acct, n, first, src] = line.split("\t");
    return { descr, label, dir, acct, n: Number(n), first, src };
  });

const train = rows.filter((r) => r.first < SPLIT_DATE);
const test = rows.filter((r) => r.first >= SPLIT_DATE);

// ── Masking: what would be sent to a third-party model ──────────────────────
// Amounts, dates, times, card/account digits and person names never leave.
export function mask(raw: string): string {
  return raw
    .replace(/^CRISTIAN[\w ,]*?(pagaste|transferiste)/i, "<USUARIO> $1")
    .replace(/a la llave @?\S+/gi, "a la llave <LLAVE>")
    .replace(/ a [A-ZÁÉÍÓÚÑ ]{6,}? el /g, " a <PERSONA> el ")
    .replace(/de [A-ZÁÉÍÓÚÑ ]{4,}? en tu cuenta/g, "de <PERSONA> en tu cuenta")
    .replace(/^TRANSF A [A-ZÁÉÍÓÚÑ ]+$/i, "TRANSF A <PERSONA>")
    // QR transfers to a natural person (no company suffix) name the person.
    .replace(/^TRANSF QR (?!.*\b(SAS|S\.?A\.?S?|LTDA|E\.?U)\b).+$/i, "TRANSF QR <PERSONA>")
    .replace(/(COP|USD|\$)\s?[\d.,]+/g, "$1<MONTO>")
    .replace(/\*+\d{3,}/g, "*<NUM>")
    .replace(/\d{1,2}\/\d{1,2}\/\d{2,4}/g, "<FECHA>")
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, "<FECHA>")
    .replace(/\d{1,2}:\d{2}/g, "<HORA>")
    .replace(/\b\d{5,}\b/g, "<NUM>");
}

/** Pulls the merchant out of Bancolombia notification-style text. */
function merchantOf(descr: string): string {
  const m = descr.match(/ en (.+?)(?: con tu|, el )/i);
  return cleanDescription(m ? m[1] : descr);
}

// ── Method A: built-in deterministic rules, no user rules (cold start) ──────
function rulesBuiltin(r: Row): Prediction {
  const res = autoCategorize(r.descr);
  const label = res ? cats[res.category_id] ?? null : null;
  return { label, confidence: res?.categorization_confidence ?? 0, top: label ? [label] : [] };
}

// ── Method B: deterministic nearest neighbour on the train split ────────────
// Stands in for "rules learned from the user's own answers".
const STOP = new Set(["COMPRA", "EN", "INTL", "PAGO", "QR", "TRANSF", "DE", "COM", "WWW", "SA", "S", "A", "DL"]);
const tokens = (s: string) =>
  merchantOf(s)
    .split(/[^A-Z0-9Ñ]+/i)
    .map((t) => t.toUpperCase())
    .filter((t) => t.length >= 3 && !STOP.has(t) && !/^\d+$/.test(t));

function knn(r: Row): Prediction {
  const q = new Set(tokens(r.descr));
  const scores = new Map<string, number>();
  for (const t of train) {
    const overlap = tokens(t.descr).filter((x) => q.has(x)).length;
    if (overlap > 0) scores.set(t.label, (scores.get(t.label) ?? 0) + overlap * Math.log(1 + t.n));
  }
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return { label: null, confidence: 0, top: [] };
  const total = ranked.reduce((s, [, v]) => s + v, 0);
  return { label: ranked[0][0], confidence: ranked[0][1] / total, top: ranked.slice(0, 3).map(([l]) => l) };
}

// ── Method C/D: Jev (cold, and with a few masked labelled neighbours) ───────
function jevState(r: Row, withExamples: boolean) {
  const state: Record<string, unknown> = {
    descripcion_banco: mask(r.descr),
    direccion: r.dir === "INFLOW" ? "entra dinero" : "sale dinero",
    tipo_cuenta: r.acct,
  };
  if (withExamples) {
    const q = new Set(tokens(r.descr));
    state.ejemplos_del_usuario = train
      .map((t) => ({ t, s: tokens(t.descr).filter((x) => q.has(x)).length }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 5)
      .map(({ t }) => ({ descripcion: mask(t.descr), categoria: t.label }));
  }
  return state;
}

async function jev(r: Row, withExamples: boolean): Promise<Prediction> {
  const res = await jevChoice({
    state: jevState(r, withExamples),
    question: "¿En qué categoría de gasto o ingreso va este movimiento bancario?",
    options: labels,
  });
  const top = Object.entries(res.probabilities)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([l]) => l);
  return { label: res.choice, confidence: res.confidence, top };
}

// ── Metrics ─────────────────────────────────────────────────────────────────
const parent = (l: string | null) => (l ? l.split(" > ")[0] : null);

function report(name: string, items: Row[], preds: Prediction[]) {
  const n = items.length;
  let covered = 0, exact = 0, par = 0, top3 = 0;
  items.forEach((r, i) => {
    const p = preds[i];
    if (p.label) covered++;
    if (p.label === r.label) exact++;
    if (parent(p.label) === parent(r.label)) par++;
    if (p.top.includes(r.label)) top3++;
  });
  const pct = (x: number, d = n) => (d ? `${((100 * x) / d).toFixed(0)}%` : "—");
  console.log(
    `| ${name} | ${n} | ${pct(covered)} | ${pct(exact)} | ${pct(exact, covered)} | ${pct(par)} | ${pct(top3)} |`,
  );
  // Precision/coverage at confidence thresholds (what a "pre-select" rule would see)
  const th = [0.5, 0.7, 0.8, 0.9, 0.95]
    .map((t) => {
      const sel = items.map((r, i) => ({ r, p: preds[i] })).filter(({ p }) => p.label && p.confidence >= t);
      const ok = sel.filter(({ r, p }) => p.label === r.label).length;
      return `≥${t}: cov ${pct(sel.length)}, prec ${pct(ok, sel.length)}`;
    })
    .join(" · ");
  console.log(`|   ↳ thresholds | ${th} ||||||`);
}

async function main() {
  const subsets: [string, Row[]][] = [
    ["test (all)", test],
    ["test, unseen merchant", test.filter((r) => knn(r).label === null)],
    ["test, user-corrected (hard)", test.filter((r) => r.src.includes("O") || r.src.includes("C"))],
  ];
  console.log(`train=${train.length} rows · test=${test.length} rows · split ${SPLIT_DATE} · ${labels.length} categories\n`);
  for (const [sname, items] of subsets) {
    console.log(`\n### ${sname}\n`);
    console.log("| method | n | coverage | accuracy | precision when answered | parent-level acc | top-3 |");
    console.log("|---|---|---|---|---|---|---|");
    report("rules (built-in, cold)", items, items.map(rulesBuiltin));
    report("nearest neighbour (learned)", items, items.map(knn));
    if (jevAvailable()) {
      const cold: Prediction[] = [];
      const few: Prediction[] = [];
      for (const r of items) {
        cold.push(await jev(r, false));
        few.push(await jev(r, true));
      }
      report("Jev cold", items, cold);
      report("Jev + 5 user examples", items, few);
    }
  }
  if (!jevAvailable()) console.log("\n(Jev skipped: TYPESAFE_API_KEY not set or client not implemented.)");
}

main();
