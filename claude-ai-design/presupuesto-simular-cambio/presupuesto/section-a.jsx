// Sección A — Entrada a la simulación + estado de modo (3 variantes)
const { useState: useStateSA } = React;

// Héroe en modo simulación — compartido entre variantes
function ScenHero({ actions = true, ghostReal = true, style }) {
  return (
    <div style={{
      borderRadius: 16, border: `1.5px dashed ${SCEN.border}`,
      background: `linear-gradient(180deg, ${SCEN.bg}, rgba(18,20,18,0.6))`,
      padding: 16, ...style,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <ScenTag />
        <span style={{ fontSize: 10, color: Z.sageDark }}>sin guardar</span>
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: Z.sageDark }}>Ingreso</div>
          <Num v={fmtCOP(PINGRESO)} size={15} weight={700} color={Z.sageLight} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: Z.sageDark }}>Escenario</div>
          <Num v={fmtCOP(PTOT.scen)} size={15} weight={700} />
        </div>
        <div style={{ flex: 1, textAlign: "right" }}>
          <div style={{ fontSize: 10, color: Z.sageDark }}>Restante</div>
          <Num v={`−${fmtCOP(PTOT.brechaPresupuesto)}`} size={15} weight={700} color={Z.debt} />
        </div>
      </div>
      <div style={{ marginTop: 10, position: "relative" }}>
        <UsageBar pct={100} color={Z.debt} height={5} />
        <div style={{ position: "absolute", top: -2, bottom: -2, left: `${(PINGRESO / PTOT.scen) * 100}%`, width: 2, borderRadius: 1, background: "rgba(246,240,227,0.55)" }}></div>
      </div>
      {ghostReal && (
        <div style={{ marginTop: 8, fontSize: 10, color: Z.sageDark, fontVariantNumeric: "tabular-nums" }}>
          Real: asignado {fmtCOP(PTOT.cur)} · restante <span style={{ color: Z.income }}>{fmtCOP(PTOT.restanteCur)}</span>
        </div>
      )}
      {actions && (
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <ZBtn variant="ghost" size="sm" style={{ flex: 1 }}>Descartar</ZBtn>
          <ZBtn variant="brass" size="sm" style={{ flex: 1 }}>Aplicar…</ZBtn>
        </div>
      )}
    </div>
  );
}

// ── A1 · El héroe se transforma ───────────────────────────────
function EntradaA1() {
  return (
    <React.Fragment>
      <StateTag>Real · punto de entrada bajo el héroe</StateTag>
      <PageHead />
      <MonthSel />
      <HeroReal />
      <button style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        height: 40, borderRadius: 12, cursor: "pointer", fontFamily: "var(--font-sans)",
        border: `1px dashed ${SCEN.border}`, background: SCEN.bg,
        color: SCEN.c, fontSize: 13, fontWeight: 600, transition: "background 150ms",
      }}>
        <ZIcon d={PIcons.sliders} size={14} sw={2} />
        Simular un cambio
      </button>

      <StateTag>Simulación activa · el héroe cambia de marco</StateTag>
      <PageHead tag={<ScenTag style={{ marginBottom: 4 }}>Mudanza</ScenTag>} />
      <MonthSel />
      <ScenHero />
    </React.Fragment>
  );
}

// ── A2 · Banner persistente + zona sandbox ────────────────────
function BannerScen({ compact = false }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: compact ? "5px 10px" : "8px 12px",
      borderRadius: compact ? 999 : 12,
      border: `1px solid ${SCEN.border}`, background: SCEN.bgStrong,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: SCEN.c, flexShrink: 0 }}></span>
      <span style={{ flex: 1, fontSize: compact ? 11 : 12, fontWeight: 600, color: SCEN.c, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        Simulación · Mudanza
      </span>
      <button style={{
        border: "none", background: "transparent", color: Z.sageLight, fontSize: compact ? 11 : 12,
        fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)", padding: "4px 6px",
      }}>Descartar</button>
      <button style={{
        border: `1px solid ${SCEN.border}`, background: "rgba(212,168,67,0.16)", color: SCEN.c,
        fontSize: compact ? 11 : 12, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-sans)",
        borderRadius: 8, padding: compact ? "3px 9px" : "5px 11px", transition: "background 150ms",
      }}>Aplicar</button>
    </div>
  );
}

function EntradaA2() {
  return (
    <React.Fragment>
      <StateTag>Simulación activa · banner fino arriba</StateTag>
      <BannerScen />
      <PageHead />
      <MonthSel />
      {/* zona sandbox: hairline punteado dorado alrededor del contenido */}
      <div style={{ border: `1px dashed ${SCEN.borderSoft}`, borderRadius: 18, padding: 10, display: "flex", flexDirection: "column", gap: 10 }}>
        <ScenHero actions={false} />
        <ZRow style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: Z.white }}>Arriendo</span>
            <NuevoBadge />
          </span>
          <Num v={fmtCOP(1500000)} size={13} />
        </ZRow>
        <ZRow style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: Z.white }}>Mercado</span>
            <DeltaChip v={300000} />
          </span>
          <Num v={fmtCOP(650000)} size={13} />
        </ZRow>
      </div>

      <StateTag>Al hacer scroll · banner condensado</StateTag>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <BannerScen compact={true} />
      </div>
    </React.Fragment>
  );
}

// ── A3 · Plantillas de entrada + selector de modo ─────────────
function PlantillaRow({ icon, title, sub }) {
  return (
    <ZRow onClick={() => {}} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px" }}>
      <span style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: SCEN.bg, border: `1px solid ${SCEN.borderSoft}`, color: SCEN.c,
      }}>
        <ZIcon d={icon} size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: Z.white }}>{title}</div>
        <div style={{ fontSize: 10, color: Z.sageDark, marginTop: 1 }}>{sub}</div>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={Z.sageDark} strokeWidth="1.75" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
    </ZRow>
  );
}

function ModeToggle({ mode, onChange }) {
  const opt = (key, label, active) => (
    <button key={key} onClick={() => onChange(key)} style={{
      flex: 1, height: 30, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
      fontFamily: "var(--font-sans)", transition: "background 150ms, color 150ms",
      border: active ? `1px solid ${key === "scen" ? SCEN.border : "rgba(147,120,68,0.35)"}` : "1px solid transparent",
      background: active ? (key === "scen" ? SCEN.bgStrong : Z.surface3) : "transparent",
      color: active ? (key === "scen" ? SCEN.c : Z.white) : Z.sageDark,
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
    }}>
      {key === "scen" && <span style={{ width: 6, height: 6, borderRadius: 999, background: active ? SCEN.c : Z.sageDark }}></span>}
      {label}
    </button>
  );
  return (
    <div style={{ display: "flex", gap: 4, padding: 3, borderRadius: 11, border: `1px solid ${Z.border}`, background: "rgba(0,0,0,0.25)" }}>
      {opt("real", "Real", mode === "real")}
      {opt("scen", "Simulación", mode === "scen")}
    </div>
  );
}

function EntradaA3() {
  const [mode, setMode] = useStateSA("scen");
  return (
    <React.Fragment>
      <StateTag>Entrada · hoja de plantillas</StateTag>
      <PSheet
        behind={<React.Fragment><PageHead /><MonthSel /><HeroReal /></React.Fragment>}
      >
        <Eyebrow>Simular un cambio</Eyebrow>
        <div style={{ fontSize: 17, fontWeight: 600, color: Z.white, marginTop: 6 }}>¿Qué cambio quieres probar?</div>
        <div style={{ fontSize: 11, color: Z.sageDark, marginTop: 2, marginBottom: 12 }}>Tu presupuesto real no se toca hasta que apliques.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <PlantillaRow icon={PIcons.home} title="Mudanza" sub="Arriendo, servicios, internet" />
          <PlantillaRow icon={PIcons.car} title="Vehículo" sub="Cuota, gasolina, seguro" />
          <PlantillaRow icon={PIcons.sliders} title="Desde cero" sub="Copia tu presupuesto tal cual" />
        </div>
      </PSheet>

      <StateTag>Modo como selector · toca para alternar</StateTag>
      <PageHead />
      <ModeToggle mode={mode} onChange={setMode} />
      {mode === "scen" ? <ScenHero actions={false} /> : <HeroReal />}
      <div style={{ fontSize: 10, color: Z.sageDark, textAlign: "center" }}>
        {mode === "scen" ? "Viendo la simulación — tu presupuesto real sigue intacto" : "Viendo tu presupuesto real"}
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { ScenHero, BannerScen, EntradaA1, EntradaA2, EntradaA3, ModeToggle });
