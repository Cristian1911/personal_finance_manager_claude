// Zeta shared primitives — exploraciones (copiado de deudas/zeta-ui.jsx)
// Tokens from _ds colors_and_type.css. Exported to window.

const Z = {
  ink: "#121412",
  sage: "#768053",
  brass: "#937844",
  brassHot: "#B29256",
  sageLight: "#D9CCB9",
  sageDark: "#938C7E",
  white: "#F6F0E3",
  income: "#5CB88A",
  debt: "#E05545",
  alert: "#D4A843",
  surface: "#171A17",
  surface2: "#1E221E",
  surface3: "#262B26",
  border: "rgba(255,255,255,0.06)",
};

function fmtCOP(n) {
  const sign = n < 0 ? "−" : "";
  return `${sign}$ ${Math.abs(Math.round(n)).toLocaleString("es-CO")}`;
}
function fmtM(n) {
  const abs = Math.abs(n);
  if (abs >= 1000000) return `$ ${(abs / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1000) return `$ ${Math.round(abs / 1000)}K`;
  return fmtCOP(n);
}

// ── Icons (Lucide-style, stroke 1.75) ─────────────────────────
function ZIcon({ d, size = 14, sw = 1.75, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
      {d}
    </svg>
  );
}
const IconPaths = {
  trendDown: <><polyline points="22 17 13.5 8.5 8.5 13.5 2 7" /><polyline points="16 17 22 17 22 11" /></>,
  trendUp: <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
  card: <><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></>,
  bank: <><line x1="3" y1="22" x2="21" y2="22" /><line x1="6" y1="18" x2="6" y2="11" /><line x1="10" y1="18" x2="10" y2="11" /><line x1="14" y1="18" x2="14" y2="11" /><line x1="18" y1="18" x2="18" y2="11" /><polygon points="12 2 20 7 4 7" /></>,
  arrowRight: <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>,
  sparkle: <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z" />,
};

function Chevron({ open, size = 16, color = Z.sageDark }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: "transform 180ms ease", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function PlusToggle({ open, size = 24 }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: 999, flexShrink: 0,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      border: `1px solid rgba(147,120,68,0.20)`, background: "rgba(147,120,68,0.08)",
      color: Z.brass, transition: "transform 180ms ease",
      transform: open ? "rotate(45deg)" : "rotate(0deg)",
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
    </span>
  );
}

// ── Type ──────────────────────────────────────────────────────
function Eyebrow({ children, color, style }) {
  return <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: color || Z.sageDark, ...style }}>{children}</div>;
}
function Num({ v, size = 18, weight = 600, color, style }) {
  return <span style={{ fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum" 1', fontSize: size, fontWeight: weight, letterSpacing: size >= 28 ? "-0.02em" : 0, color: color || Z.white, ...style }}>{v}</span>;
}

// ── Cards ─────────────────────────────────────────────────────
function ZCard({ children, style, onClick, active, ...rest }) {
  return (
    <div onClick={onClick} {...rest} style={{
      borderRadius: 16,
      border: `1px solid ${active ? "rgba(147,120,68,0.35)" : Z.border}`,
      background: "rgba(30,34,30,0.8)",
      padding: 16,
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
      cursor: onClick ? "pointer" : "default",
      transition: "border-color 150ms",
      ...style,
    }}>{children}</div>
  );
}
function ZRow({ children, style, onClick, ...rest }) {
  return (
    <div onClick={onClick} {...rest} style={{
      borderRadius: 12, border: `1px solid ${Z.border}`, background: "#111",
      padding: "8px 12px", cursor: onClick ? "pointer" : "default", ...style,
    }}>{children}</div>
  );
}
function ZStat({ children, style, onClick, active, ...rest }) {
  return (
    <div onClick={onClick} {...rest} style={{
      borderRadius: 16, border: `1px solid ${active ? "rgba(147,120,68,0.35)" : Z.border}`,
      background: "rgba(0,0,0,0.10)", padding: 16,
      cursor: onClick ? "pointer" : "default", transition: "border-color 150ms", ...style,
    }}>{children}</div>
  );
}

// ── Buttons ───────────────────────────────────────────────────
function ZBtn({ variant = "brass", size = "lg", children, icon, style, onClick }) {
  const sizes = {
    sm: { height: 32, padding: "0 12px", fontSize: 12 },
    md: { height: 36, padding: "0 16px", fontSize: 13 },
    lg: { height: 44, padding: "0 16px", fontSize: 14 },
  };
  const variants = {
    brass: { background: Z.brass, color: Z.ink, border: "1px solid transparent" },
    ghost: { background: "rgba(0,0,0,0.10)", color: Z.sageLight, border: `1px solid rgba(255,255,255,0.08)` },
    "brass-ghost": { background: "rgba(147,120,68,0.08)", color: Z.brass, border: "1px solid rgba(147,120,68,0.20)" },
  };
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
      borderRadius: 10, fontWeight: 600, cursor: "pointer",
      fontFamily: "var(--font-sans)", transition: "background 150ms",
      ...sizes[size], ...variants[variant], ...style,
    }}>{icon}{children}</button>
  );
}

// ── Chips ─────────────────────────────────────────────────────
function StateChip({ tone = "neutral", children, icon, style }) {
  const tones = {
    neutral: { c: Z.sageLight, b: "rgba(217,204,185,0.16)", bg: "rgba(18,20,18,0.4)" },
    brass: { c: Z.brass, b: "rgba(147,120,68,0.35)", bg: "rgba(147,120,68,0.08)" },
    income: { c: Z.income, b: "rgba(92,184,138,0.35)", bg: "rgba(92,184,138,0.08)" },
    debt: { c: Z.debt, b: "rgba(224,85,69,0.35)", bg: "rgba(224,85,69,0.08)" },
    alert: { c: Z.alert, b: "rgba(212,168,67,0.35)", bg: "rgba(212,168,67,0.08)" },
  };
  const t = tones[tone];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px",
      borderRadius: 999, fontSize: 10, fontWeight: 600, letterSpacing: "0.02em",
      border: `1px solid ${t.b}`, background: t.bg, color: t.c, whiteSpace: "nowrap", flexShrink: 0, ...style,
    }}>{icon}{children}</span>
  );
}

// ── Progress ──────────────────────────────────────────────────
function UsageBar({ pct, color = Z.brass, height = 4, track = "rgba(255,255,255,0.06)", style }) {
  return (
    <div style={{ height, borderRadius: 999, background: track, overflow: "hidden", width: "100%", ...style }}>
      <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: color, borderRadius: 999, transition: "width 200ms" }}></div>
    </div>
  );
}

function Ring({ pct, size = 44, stroke = 4, color = Z.brass, children, trackColor = "rgba(255,255,255,0.08)" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, pct) / 100)} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 200ms" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>
    </div>
  );
}

// ── Expand wrapper (grid-rows 0fr→1fr) ────────────────────────
function Expand({ open, children }) {
  return (
    <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: "grid-template-rows 200ms ease" }}>
      <div style={{ overflow: "hidden", minHeight: 0 }}>{children}</div>
    </div>
  );
}

// ── Segmented control (3 lenses) ──────────────────────────────
function Segmented({ options, value, onChange }) {
  return (
    <div style={{
      display: "flex", gap: 4, padding: 3, borderRadius: 12,
      border: `1px solid ${Z.border}`, background: "rgba(0,0,0,0.25)",
    }}>
      {options.map((o) => (
        <button key={o} onClick={() => onChange && onChange(o)} style={{
          flex: 1, height: 32, borderRadius: 9, border: "1px solid transparent",
          background: value === o ? Z.surface3 : "transparent",
          color: value === o ? Z.white : Z.sageDark,
          fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)",
          transition: "background 150ms, color 150ms",
          borderColor: value === o ? "rgba(147,120,68,0.35)" : "transparent",
        }}>{o}</button>
      ))}
    </div>
  );
}

// ── Frame: 390px page region ──────────────────────────────────
function Frame({ children, lens, style, ...rest }) {
  return (
    <div {...rest} style={{
      width: 390, boxSizing: "border-box", background: Z.surface,
      padding: 16, display: "flex", flexDirection: "column", gap: 12,
      fontFamily: "var(--font-sans)", color: Z.white, position: "relative",
      minHeight: "100%", ...style,
    }}>
      {lens && <Segmented options={["Carga", "Plan", "Cuentas"]} value={lens} />}
      {children}
    </div>
  );
}

// Small state caption inside frames ("COLAPSADO" / "EXPANDIDO")
function StateTag({ children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "2px 0" }}>
      <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(147,120,68,0.75)", whiteSpace: "nowrap" }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: "rgba(147,120,68,0.18)" }}></span>
    </div>
  );
}

// Avatar initials circle
function Avatar({ initials, size = 28, offset = 0 }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: 999, flexShrink: 0,
      marginLeft: offset, display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: Z.surface3, border: `1.5px solid ${Z.surface}`,
      color: Z.sageLight, fontSize: size * 0.36, fontWeight: 700, letterSpacing: "0.02em",
    }}>{initials}</span>
  );
}

Object.assign(window, {
  Z, fmtCOP, fmtM, ZIcon, IconPaths, Chevron, PlusToggle,
  Eyebrow, Num, ZCard, ZRow, ZStat, ZBtn, StateChip, UsageBar, Ring,
  Expand, Segmented, Frame, StateTag, Avatar,
});
