// Genera canvas/<Name>.dc.html desde preview/ps-*.html.
// Una fuente (las DS cards con tokens reales), dos salidas (DS + canvas de Claude Design).
// Uso: node build.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "canvas");
mkdirSync(out, { recursive: true });

const NAMES = {
  "ps-mapa": "Main",
  "ps-dia0-chooser": "Dia0Chooser",
  "ps-dia0-import": "Dia0Import",
  "ps-dia1-inicio": "Dia1Inicio",
  "ps-sem1-inicio": "Sem1Inicio",
  "ps-sem1-movimiento": "Sem1Movimiento",
  "ps-sem2-recurrentes": "Sem2Recurrentes",
  "ps-sem2-digest": "Sem2Digest",
  "ps-guia-import": "GuiaImport",
  "ps-mes1-presupuesto": "Mes1Presupuesto",
  "ps-mes2-tendencias": "Mes2Tendencias",
  "ps-mas": "Mas",
};

// Tokens sin @import ni @font-face: el iframe del canvas no tiene red salvo Google Fonts,
// y Geist se carga por <link> en el helmet.
// El runtime del canvas no conserva las custom properties de CSS (var(--z-*) llega vacio),
// asi que aqui se resuelven a su valor literal en CSS y en los style="" del markup.
const rawTokens = readFileSync(join(here, "colors_and_type.css"), "utf8")
  .replace(/@import[^;]+;/g, "")
  .replace(/@font-face\s*\{[^}]*\}/g, "");
const rootBlock = rawTokens.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
const VARS = Object.fromEntries(
  [...rootBlock.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim()]),
);
function resolveVars(css) {
  let out = css;
  for (let i = 0; i < 8 && /var\(--/.test(out); i++) {
    out = out.replace(/var\((--[\w-]+)(?:\s*,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/g, (m, k, fb) =>
      VARS[k] ?? (fb !== undefined ? fb.trim() : m));
  }
  const left = [...new Set(out.match(/var\((--[\w-]+)/g) ?? [])];
  if (left.length) console.warn(`sin resolver: ${left.join(", ")}`);
  return out;
}
const tokens = resolveVars(rawTokens.replace(/:root\s*\{[\s\S]*?\n\}/, ""));
const shared = resolveVars(readFileSync(join(here, "preview", "ps.css"), "utf8"));

const FONT = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&display=swap">';

for (const [src, name] of Object.entries(NAMES)) {
  const html = readFileSync(join(here, "preview", `${src}.html`), "utf8");
  const local = resolveVars(html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "");
  const body = resolveVars(html.match(/<body>([\s\S]*?)<\/body>/)?.[1]?.trim() ?? "");
  if (!body) throw new Error(`sin <body> en ${src}`);
  const dc = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  ${FONT}
  <style>
${tokens}
${shared}
${local}
  </style>
</helmet>
${body}
</x-dc>
</body>
</html>
`;
  writeFileSync(join(out, `${name}.dc.html`), dc);
  console.log(`${name}.dc.html ← ${src}.html (${(dc.length / 1024).toFixed(1)} KB)`);
}
