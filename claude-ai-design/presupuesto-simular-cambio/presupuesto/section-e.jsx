// Sección E — Aplicar / comparar (2 variantes)
const { useState: useStateSE } = React;

// Valores finales del escenario "Mudanza" con recortes aplicados (total 4.235.000)
const FINAL_VALS = {
  arriendo: 1500000, servicios: 220000, internet: 95000,
  mercado: 650000, restaurantes: 150000, salidas: 130000, ahorro: 300000,
};

function CompareRow({ name, cur, scen, nuevo }) {
  const delta = cur == null ? null : scen - cur;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "9px 11px",
      borderRadius: 11, border: `1px solid ${SCEN.borderSoft}`, background: SCEN.bg,
    }}>
      <span style={{ flex: 1, display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: Z.white, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
        {nuevo && <NuevoBadge />}
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {cur != null && (
          <React.Fragment>
            <Num v={fmtCOP(cur)} size={11} weight={500} color={Z.sageDark} style={{ textDecoration: "line-through", textDecorationColor: "rgba(147,140,126,0.5)" }} />
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={Z.sageDark} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
          </React.Fragment>
        )}
        <Num v={fmtCOP(scen)} size={13} weight={700} />
        {delta != null && <DeltaChip v={delta} />}
        {nuevo && <DeltaChip v={scen} />}
      </span>
    </div>
  );
}

function CompareTotals() {
  const col = (label, asignado, restante, tone) => (
    <div style={{ flex: 1, borderRadius: 12, border: `1px solid ${Z.border}`, background: "rgba(0,0,0,0.18)", padding: "10px 12px" }}>
      <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: Z.sageDark }}>{label}</div>
      <div style={{ marginTop: 5 }}><Num v={fmtCOP(asignado)} size={15} weight={700} /></div>
      <div style={{ fontSize: 10, marginTop: 2, fontVariantNumeric: "tabular-nums", color: Z.sageDark }}>
        restante <span style={{ color: tone, fontWeight: 700 }}>{fmtCOP(restante)}</span>
      </div>
    </div>
  );
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
      {col("Actual", PTOT.cur, PTOT.restanteCur, Z.income)}
      <span style={{ alignSelf: "center", color: Z.sageDark }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
      </span>
      {col("Escenario", PTOT.scenCut, PINGRESO - PTOT.scenCut, Z.income)}
    </div>
  );
}

// ── E1 · Hoja de comparación + aplicar desde [mes] ────────────
function AplicarE1() {
  const [showSame, setShowSame] = useStateSE(false);
  const changed = PCATS.filter((c) => c.nuevo || (FINAL_VALS[c.id] != null && FINAL_VALS[c.id] !== c.cur));
  const same = PCATS.filter((c) => !c.nuevo && FINAL_VALS[c.id] == null);
  return (
    <PSheet style={{ maxHeight: "none" }} behind={
      <React.Fragment>
        <BannerScen />
        <MonthSel />
        <ScenHero actions={false} ghostReal={false} />
      </React.Fragment>
    }>
      <Eyebrow>Aplicar escenario</Eyebrow>
      <div style={{ fontSize: 17, fontWeight: 600, color: Z.white, marginTop: 4 }}>Mudanza → presupuesto real</div>
      <div style={{ marginTop: 12 }}>
        <CompareTotals />
      </div>

      <div className="z-divider" style={{ marginTop: 14, marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: SCEN.c }}>Cambia · {changed.length}</span>
        <span className="line"></span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {changed.map((c) => (
          <CompareRow key={c.id} name={c.name} cur={c.cur} scen={FINAL_VALS[c.id]} nuevo={c.nuevo} />
        ))}
      </div>

      <button onClick={() => setShowSame(!showSame)} style={{
        marginTop: 8, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        height: 30, borderRadius: 9, border: `1px solid ${Z.border}`, background: "transparent",
        color: Z.sageDark, fontSize: 10.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)",
      }}>
        {same.length} categorías sin cambios <Chevron open={showSame} size={12} />
      </button>
      <Expand open={showSame}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingTop: 6 }}>
          {same.map((c) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 11px", borderRadius: 10, border: `1px solid ${Z.border}`, background: "#111" }}>
              <span style={{ fontSize: 12, color: Z.sageLight }}>{c.name}</span>
              <Num v={fmtCOP(c.cur)} size={12} weight={600} color={Z.sageLight} />
            </div>
          ))}
        </div>
      </Expand>

      <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
        <ZBtn variant="ghost" size="lg" style={{ flex: 1 }}>Cancelar</ZBtn>
        <ZBtn variant="brass" size="lg" style={{ flex: 2 }}>Aplicar desde julio</ZBtn>
      </div>
      <div style={{ marginTop: 9, fontSize: 10, color: Z.sageDark, textAlign: "center", lineHeight: 1.5 }}>
        Junio no cambia. Tu presupuesto anterior queda guardado por si quieres volver.
      </div>
    </PSheet>
  );
}

// ── E2 · Guardar como borrador con nombre ─────────────────────
function AplicarE2() {
  return (
    <React.Fragment>
      <StateTag>Guardar en vez de aplicar</StateTag>
      <PSheet behind={
        <React.Fragment>
          <BannerScen />
          <MonthSel />
          <ScenHero actions={false} ghostReal={false} />
        </React.Fragment>
      }>
        <Eyebrow>Guardar simulación</Eyebrow>
        <div style={{ fontSize: 11, color: Z.sageDark, marginTop: 4, marginBottom: 10 }}>Vuelve cuando quieras — no toca tu presupuesto.</div>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, height: 44, padding: "0 12px",
          borderRadius: 12, border: "1px solid rgba(217,204,185,0.16)", background: "rgba(30,34,30,0.55)",
        }}>
          <ZIcon d={PIcons.bookmark} size={14} style={{ color: SCEN.c }} />
          <input defaultValue="Mudanza" style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            color: Z.white, fontSize: 14, fontWeight: 600, fontFamily: "var(--font-sans)",
          }} />
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <StateChip tone="debt">faltan {fmtM(PTOT.falta)}/mes</StateChip>
          <StateChip tone="neutral">3 nuevos · 1 sube · 1 recorte</StateChip>
          <StateChip tone="neutral">{fmtM(PARR_TOTAL)} de arranque</StateChip>
        </div>
        <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
          <ZBtn variant="ghost" size="lg" style={{ flex: 1 }}>Aplicar ahora</ZBtn>
          <ZBtn variant="brass" size="lg" style={{ flex: 1 }}>Guardar borrador</ZBtn>
        </div>
      </PSheet>

      <StateTag>De vuelta en el presupuesto real · borrador guardado</StateTag>
      <PageHead />
      <MonthSel />
      <HeroReal />
      <div className="z-divider">
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: Z.sageDark }}>Simulaciones guardadas</span>
        <span className="line"></span>
      </div>
      <div style={{
        borderRadius: 14, border: `1px dashed ${SCEN.borderSoft}`, background: SCEN.bg,
        padding: "11px 13px", display: "flex", alignItems: "center", gap: 11,
      }}>
        <span style={{
          width: 32, height: 32, borderRadius: 10, flexShrink: 0,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: SCEN.bgStrong, border: `1px solid ${SCEN.borderSoft}`, color: SCEN.c,
        }}>
          <ZIcon d={PIcons.home} size={15} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: Z.white }}>Mudanza</span>
            <span style={{ fontSize: 10, color: Z.sageDark }}>hace 2 días</span>
          </div>
          <div style={{ fontSize: 10.5, color: Z.debt, fontWeight: 600, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>
            faltan {fmtCOP(PTOT.falta)}/mes
          </div>
        </div>
        <ZBtn variant="brass-ghost" size="sm">Continuar</ZBtn>
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { AplicarE1, AplicarE2, CompareRow });
