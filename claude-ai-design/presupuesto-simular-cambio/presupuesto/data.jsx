// Presupuesto · "Simular cambio" — datos de muestra + primitivas compartidas
// Matemática del escenario (documentada para consistencia entre secciones):
//   Ingreso 4.500.000 · presupuesto actual 2.690.000 · restante 1.810.000
//   Escenario (sin recortes) 4.805.000 → brecha de presupuesto −305.000
//   Sobregasto real (prom 3m > presupuesto en líneas no tocadas):
//     Transporte +15.000 · Restaurantes +85.000 · Salidas +60.000 = 160.000
//   Reserva de arranque: 615.000/mes (arranque 3.450.000 listo en 6 meses)
//   FALTA TOTAL = 305 + 160 + 615 = 1.080.000/mes  ← veredicto
//   Recortes: Restaurantes −150 (alivio 235) · Salidas −120 (alivio 180)
//     · Ahorro −300 · Suscripciones −45 · Aplazar muebles (alivio 340)
//   Todos aplicados → sobra 20.000/mes. Escenario con recortes: 4.235.000.

const PINGRESO = 4500000;
Z.expense = "#E8875A";

const PCATS = [
  { id: "arriendo",      name: "Arriendo",      cur: null,   scen: 1500000, prom: null,   nuevo: true,  grupo: "nec" },
  { id: "servicios",     name: "Servicios",     cur: null,   scen: 220000,  prom: null,   nuevo: true,  grupo: "nec" },
  { id: "internet",      name: "Internet",      cur: null,   scen: 95000,   prom: null,   nuevo: true,  grupo: "nec" },
  { id: "mercado",       name: "Mercado",       cur: 350000, scen: 650000,  prom: 410000, grupo: "nec" },
  { id: "transporte",    name: "Transporte",    cur: 280000, scen: 280000,  prom: 295000, grupo: "nec" },
  { id: "restaurantes",  name: "Restaurantes",  cur: 300000, scen: 300000,  prom: 385000, grupo: "gusto" },
  { id: "suscripciones", name: "Suscripciones", cur: 95000,  scen: 95000,   prom: 95000,  grupo: "gusto" },
  { id: "salidas",       name: "Salidas",       cur: 250000, scen: 250000,  prom: 310000, grupo: "gusto" },
  { id: "deudas",        name: "Deudas",        cur: 815000, scen: 815000,  prom: 815000, fijo: true, grupo: "nec" },
  { id: "ahorro",        name: "Ahorro",        cur: 600000, scen: 600000,  prom: 600000, grupo: "ahorro" },
];

const PTOT = {
  cur: 2690000,
  scen: 4805000,          // sin recortes
  scenCut: 4235000,       // con recortes (rest −150, salidas −120, ahorro −300)
  restanteCur: 1810000,
  brechaPresupuesto: 305000,
  sobregasto: 160000,
  reservaArranque: 615000,
  falta: 1080000,
  sobraConTodo: 20000,
};

// Candidatos a recorte — "alivio" = recorte + sobregasto que desaparece (+ reserva si aplaza)
const PCUTS = [
  { id: "restaurantes", name: "Restaurantes", recorte: 150000, alivio: 235000, de: 300000, a: 150000, prom: 385000, nota: "Tu promedio real es $ 385.000 — recorte exigente" },
  { id: "salidas",      name: "Salidas",      recorte: 120000, alivio: 180000, de: 250000, a: 130000, prom: 310000, nota: "Tu promedio real es $ 310.000" },
  { id: "ahorro",       name: "Ahorro",       recorte: 300000, alivio: 300000, de: 600000, a: 300000, prom: 600000, nota: "Pausa parcial mientras te estabilizas" },
  { id: "suscripciones", name: "Suscripciones", recorte: 45000, alivio: 45000, de: 95000, a: 50000, prom: 95000, nota: "2 servicios que casi no usas" },
  { id: "muebles",      name: "Aplazar muebles de sala", recorte: 0, alivio: 340000, aplaza: true, nota: "La reserva de arranque baja de $ 615.000 a $ 275.000/mes" },
];

// Gastos de arranque (one-time) — verdicto del motor de Deseos
const PARRANQUE = [
  { id: "cocina",  name: "Cocina y menaje", monto: 450000,  verdict: "COMPRA",      score: 84, deseo: false },
  { id: "nevera",  name: "Nevera",          monto: 1200000, verdict: "CON CUIDADO", score: 58, deseo: true },
  { id: "muebles", name: "Muebles de sala", monto: 1800000, verdict: "ESPERA",      score: 31, deseo: true },
];
const PCOLCHON = 1700000;
const PARR_TOTAL = 3450000;

// 50/30/20 — montos por grupo (target = % del ingreso)
const PALLOC = {
  targets: { nec: 2250000, gusto: 1350000, ahorro: 900000 },
  cur:     { nec: 1445000, gusto: 645000,  ahorro: 600000 },
  scen:    { nec: 3560000, gusto: 645000,  ahorro: 600000 },
  scenCut: { nec: 3560000, gusto: 375000,  ahorro: 300000 },
};

// ── Acento de simulación (oro de alerta, sandbox) ─────────────
const SCEN = {
  c: Z.alert,
  border: "rgba(212,168,67,0.35)",
  borderSoft: "rgba(212,168,67,0.22)",
  bg: "rgba(212,168,67,0.07)",
  bgStrong: "rgba(212,168,67,0.12)",
};

// ── Iconos extra (trazo Lucide 1.75) ──────────────────────────
const PIcons = {
  home: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  scissors: <><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></>,
  check: <polyline points="20 6 9 17 4 12" />,
  x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  heart: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />,
  sliders: <><line x1="21" y1="4" x2="14" y2="4" /><line x1="10" y1="4" x2="3" y2="4" /><line x1="21" y1="12" x2="12" y2="12" /><line x1="8" y1="12" x2="3" y2="12" /><line x1="21" y1="20" x2="16" y2="20" /><line x1="12" y1="20" x2="3" y2="20" /><line x1="14" y1="2" x2="14" y2="6" /><line x1="8" y1="10" x2="8" y2="14" /><line x1="16" y1="18" x2="16" y2="22" /></>,
  alertTri: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  fridge: <><rect x="6" y="2" width="12" height="20" rx="2" /><line x1="6" y1="10" x2="18" y2="10" /><line x1="9" y1="5" x2="9" y2="7" /><line x1="9" y1="13" x2="9" y2="16" /></>,
  sofa: <><path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3" /><path d="M2 13v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a2 2 0 0 0-4 0v1H6v-1a2 2 0 0 0-4 0z" /><line x1="5" y1="18" x2="5" y2="20" /><line x1="19" y1="18" x2="19" y2="20" /></>,
  chefhat: <><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z" /><line x1="6" y1="17" x2="18" y2="17" /></>,
  bookmark: <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />,
  car: <><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /><path d="M9 17h6" /></>,
  rotate: <><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></>,
};

// ── Chips y badges ────────────────────────────────────────────
function DeltaChip({ v, style }) {
  // v > 0 = más gasto (naranja) · v < 0 = recorte (verde)
  const up = v > 0;
  const c = up ? Z.expense || "#E8875A" : Z.income;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "2px 7px", borderRadius: 999,
      fontSize: 10, fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", flexShrink: 0,
      color: c, background: `${up ? "rgba(232,135,90,0.10)" : "rgba(92,184,138,0.10)"}`,
      border: `1px solid ${up ? "rgba(232,135,90,0.30)" : "rgba(92,184,138,0.30)"}`, ...style,
    }}>{up ? "+" : "−"}$ {Math.abs(v).toLocaleString("es-CO")}</span>
  );
}

function NuevoBadge() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "1px 6px", borderRadius: 5,
      fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase",
      color: SCEN.c, background: SCEN.bgStrong, border: `1px solid ${SCEN.borderSoft}`, flexShrink: 0,
    }}>nuevo</span>
  );
}

function FijoBadge() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: Z.sageDark, flexShrink: 0 }}>
      <ZIcon d={PIcons.lock} size={10} sw={2} /> fijo
    </span>
  );
}

const AFFORD_TONES = {
  "COMPRA":         { c: Z.income,  b: "rgba(92,184,138,0.35)", bg: "rgba(92,184,138,0.08)" },
  "CON CUIDADO":    { c: Z.alert,   b: "rgba(212,168,67,0.35)", bg: "rgba(212,168,67,0.08)" },
  "ESPERA":         { c: "#E8875A", b: "rgba(232,135,90,0.35)", bg: "rgba(232,135,90,0.08)" },
  "NO RECOMENDADO": { c: Z.debt,    b: "rgba(224,85,69,0.35)",  bg: "rgba(224,85,69,0.08)" },
};
function AffordChip({ verdict, style }) {
  const t = AFFORD_TONES[verdict];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "2px 7px", borderRadius: 999,
      fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", whiteSpace: "nowrap", flexShrink: 0,
      color: t.c, border: `1px solid ${t.b}`, background: t.bg, ...style,
    }}>{verdict}</span>
  );
}

function ScenTag({ children = "Simulación · Mudanza", style }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999,
      fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
      color: SCEN.c, background: SCEN.bgStrong, border: `1px solid ${SCEN.border}`, whiteSpace: "nowrap", ...style,
    }}>
      <ZIcon d={PIcons.sliders} size={11} sw={2} />
      {children}
    </span>
  );
}

// "prom 3m $ 410.000" — ancla de realidad
function PromLine({ prom, scen, size = 10 }) {
  if (prom == null) return <span style={{ fontSize: size, color: Z.sageDark }}>sin historial</span>;
  const warn = prom > scen;
  return (
    <span style={{ fontSize: size, color: warn ? Z.alert : Z.sageDark, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
      prom 3m <span style={{ fontWeight: 600 }}>{fmtCOP(prom)}</span>
    </span>
  );
}

// ── Chrome de página ──────────────────────────────────────────
function PageHead({ tag }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, paddingTop: 2 }}>
      <div>
        <Eyebrow>Plan</Eyebrow>
        <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: Z.white, marginTop: 4 }}>Presupuesto</div>
      </div>
      {tag}
    </div>
  );
}

function MonthSel({ label = "Junio 2026" }) {
  const arrow = (pts) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points={pts} /></svg>
  );
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8, alignSelf: "flex-start",
      padding: "6px 10px", borderRadius: 10, border: `1px solid ${Z.border}`,
      background: "#111", color: Z.sageLight, fontSize: 12, fontWeight: 500,
    }}>
      {arrow("15 18 9 12 15 6")}
      {label}
      {arrow("9 18 15 12 9 6")}
    </div>
  );
}

// Héroe real (estado actual del presupuesto)
function HeroReal({ style }) {
  return (
    <ZCard style={{
      background: "radial-gradient(circle at top left, rgba(63,70,50,0.22), transparent 42%), linear-gradient(180deg, rgba(27,30,27,0.96), rgba(18,20,18,0.98))",
      ...style,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Eyebrow>Ingreso mensual</Eyebrow>
        <StateChip tone="neutral">Flexible</StateChip>
      </div>
      <div style={{ marginTop: 6 }}>
        <Num v={fmtCOP(PINGRESO)} size={30} weight={800} />
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: Z.sageDark }}>Asignado</div>
          <Num v={fmtCOP(PTOT.cur)} size={14} weight={600} color={Z.sageLight} />
        </div>
        <div style={{ flex: 1, textAlign: "right" }}>
          <div style={{ fontSize: 10, color: Z.sageDark }}>Restante</div>
          <Num v={fmtCOP(PTOT.restanteCur)} size={14} weight={600} color={Z.income} />
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <UsageBar pct={(PTOT.cur / PINGRESO) * 100} color={Z.brass} height={5} />
      </div>
    </ZCard>
  );
}

// Hoja inferior dentro de un artboard: página atenuada detrás + sheet
function PSheet({ children, behind, style }) {
  return (
    <div style={{ position: "relative", margin: -16, minHeight: 560, display: "flex", flexDirection: "column", justifyContent: "flex-end", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, padding: 16, display: "flex", flexDirection: "column", gap: 12, filter: "brightness(0.45)", pointerEvents: "none" }}>
        {behind}
      </div>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }}></div>
      <div style={{
        position: "relative", borderTopLeftRadius: 20, borderTopRightRadius: 20,
        background: "#181C18", border: `1px solid ${Z.border}`, borderBottom: "none",
        padding: "12px 16px 20px", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)", ...style,
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.14)", margin: "0 auto 12px" }}></div>
        {children}
      </div>
    </div>
  );
}

// Barra 50/30/20 con fantasma (actual) + marca de meta
function AllocBar({ label, scenV, curV, target, color }) {
  const pct = (v) => Math.min(108, (v / PINGRESO) * 100);
  const over = scenV > target;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: Z.sageLight }}>{label}</span>
        <span style={{ fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
          <span style={{ fontWeight: 700, color: over ? Z.debt : color }}>{Math.round((scenV / PINGRESO) * 100)}%</span>
          <span style={{ color: Z.sageDark }}> · meta {Math.round((target / PINGRESO) * 100)}%</span>
        </span>
      </div>
      <div style={{ position: "relative", height: 10, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "visible" }}>
        {/* fantasma: actual */}
        <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${pct(curV)}%`, borderRadius: 999, background: "rgba(217,204,185,0.16)" }}></div>
        {/* escenario */}
        <div style={{ position: "absolute", top: 2, left: 0, height: 6, width: `${pct(scenV)}%`, borderRadius: 999, background: over ? Z.debt : color, transition: "width 200ms" }}></div>
        {/* meta */}
        <div style={{ position: "absolute", top: -2, bottom: -2, left: `${pct(target)}%`, width: 2, borderRadius: 1, background: "rgba(246,240,227,0.55)" }}></div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: 9, color: Z.sageDark, fontVariantNumeric: "tabular-nums" }}>
        <span>actual {fmtM(curV)}</span>
        <span>escenario <span style={{ color: over ? Z.debt : Z.sageLight, fontWeight: 600 }}>{fmtM(scenV)}</span></span>
      </div>
    </div>
  );
}

Object.assign(window, {
  PINGRESO, PCATS, PTOT, PCUTS, PARRANQUE, PCOLCHON, PARR_TOTAL, PALLOC,
  SCEN, PIcons, AFFORD_TONES, DeltaChip, NuevoBadge, FijoBadge, AffordChip, ScenTag,
  PromLine, PageHead, MonthSel, HeroReal, PSheet, AllocBar,
});
