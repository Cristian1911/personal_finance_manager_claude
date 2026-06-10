// Sección C — Veredicto del escenario (3 variantes, ambos estados)
const { useState: useStateSC } = React;

// ── C1 · La cuenta completa (interactivo: aplica recortes) ────
function VerdictHero({ falta }) {
  const ok = falta <= 0;
  return (
    <div style={{ textAlign: "left" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{
          width: 26, height: 26, borderRadius: 999, flexShrink: 0,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: ok ? "rgba(92,184,138,0.12)" : "rgba(224,85,69,0.12)",
          border: `1px solid ${ok ? "rgba(92,184,138,0.35)" : "rgba(224,85,69,0.35)"}`,
          color: ok ? Z.income : Z.debt,
        }}>
          <ZIcon d={ok ? PIcons.check : PIcons.alertTri} size={13} sw={2.25} />
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: ok ? Z.income : Z.debt }}>
          {ok ? "El escenario funciona" : "El escenario no alcanza"}
        </span>
      </div>
      <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 8 }}>
        <Num v={`${ok ? "+" : "−"}${fmtCOP(Math.abs(falta))}`} size={30} weight={800} color={ok ? Z.income : Z.debt} />
        <span style={{ fontSize: 12, color: Z.sageDark }}>/mes</span>
      </div>
      <div style={{ fontSize: 11, color: Z.sageDark, marginTop: 2 }}>
        {ok ? "te sobran después de todo el plan" : "te faltan para que el plan cierre"}
      </div>
    </div>
  );
}

function BreakdownRow({ label, sub, v }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: `1px solid ${Z.border}` }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: Z.sageLight }}>{label}</div>
        <div style={{ fontSize: 10, color: Z.sageDark, marginTop: 1 }}>{sub}</div>
      </div>
      <Num v={`−${fmtCOP(v)}`} size={13} weight={700} color={Z.debt} style={{ flexShrink: 0 }} />
    </div>
  );
}

function CutRow({ cut, applied, onToggle }) {
  return (
    <div style={{
      borderRadius: 12, padding: "10px 12px",
      border: `1px solid ${applied ? "rgba(92,184,138,0.30)" : Z.border}`,
      background: applied ? "rgba(92,184,138,0.05)" : "#111",
      transition: "border-color 150ms, background 150ms",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          <ZIcon d={cut.aplaza ? PIcons.calendar : PIcons.scissors} size={13} style={{ color: applied ? Z.income : Z.sageDark }} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: Z.white, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cut.name}</span>
        </span>
        <button onClick={onToggle} style={{
          flexShrink: 0, height: 28, padding: "0 11px", borderRadius: 8, cursor: "pointer",
          fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700,
          display: "inline-flex", alignItems: "center", gap: 5, transition: "background 150ms, color 150ms",
          border: `1px solid ${applied ? "rgba(92,184,138,0.35)" : SCEN.border}`,
          background: applied ? "rgba(92,184,138,0.10)" : SCEN.bg,
          color: applied ? Z.income : SCEN.c,
        }}>
          {applied && <ZIcon d={PIcons.check} size={11} sw={2.5} />}
          {applied ? "Aplicado" : "Aplicar"}
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 5 }}>
        <span style={{ fontSize: 10, color: Z.sageDark, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cut.nota}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: Z.income, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
          {cut.aplaza ? "" : `−${fmtCOP(cut.recorte)} · `}alivia {fmtCOP(cut.alivio)}
        </span>
      </div>
    </div>
  );
}

function VerdictC1({ defaultApplied = [] }) {
  const [applied, setApplied] = useStateSC(defaultApplied);
  const alivio = PCUTS.filter((c) => applied.includes(c.id)).reduce((a, c) => a + c.alivio, 0);
  const falta = PTOT.falta - alivio;
  const ok = falta <= 0;
  return (
    <ZCard style={{ borderColor: ok ? "rgba(92,184,138,0.25)" : "rgba(224,85,69,0.25)" }}>
      <VerdictHero falta={falta} />

      <div style={{ marginTop: 12 }}>
        <Eyebrow>La cuenta</Eyebrow>
        <div style={{ marginTop: 2 }}>
          <BreakdownRow label="Presupuesto del escenario" sub={`${fmtCOP(PTOT.scen)} contra ingreso de ${fmtCOP(PINGRESO)}`} v={PTOT.brechaPresupuesto} />
          <BreakdownRow label="Sobregasto real esperado" sub="Donde tu prom 3m supera el presupuesto" v={PTOT.sobregasto} />
          <BreakdownRow label="Reserva de arranque" sub={`${fmtCOP(PARR_TOTAL)} de arranque, listo en 6 meses`} v={PTOT.reservaArranque} />
        </div>
      </div>

      <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Eyebrow>Candidatos a recorte</Eyebrow>
        {alivio > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, color: Z.income, fontVariantNumeric: "tabular-nums" }}>−{fmtCOP(alivio)} aplicados</span>
        )}
      </div>
      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        {PCUTS.map((c) => (
          <CutRow key={c.id} cut={c} applied={applied.includes(c.id)}
            onToggle={() => setApplied(applied.includes(c.id) ? applied.filter((x) => x !== c.id) : [...applied, c.id])} />
        ))}
      </div>

      {ok && (
        <div style={{
          marginTop: 10, padding: "8px 11px", borderRadius: 10, display: "flex", gap: 8, alignItems: "flex-start",
          border: `1px solid ${SCEN.borderSoft}`, background: SCEN.bg,
        }}>
          <ZIcon d={PIcons.alertTri} size={13} style={{ color: SCEN.c, marginTop: 1 }} />
          <span style={{ fontSize: 10.5, color: Z.sageLight, lineHeight: 1.5 }}>
            Sin holgura: Restaurantes queda en {fmtCOP(150000)} y tu promedio real es {fmtCOP(385000)}. El plan exige cambiar hábitos, no solo números.
          </span>
        </div>
      )}
    </ZCard>
  );
}

// ── C2 · Veredicto sobre las barras 50/30/20 ─────────────────
function VerdictC2({ fits = false }) {
  const a = fits ? PALLOC.scenCut : PALLOC.scen;
  const total = a.nec + a.gusto + a.ahorro;
  const diff = PINGRESO - total;
  return (
    <ZCard>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Eyebrow>Escenario · 50 / 30 / 20</Eyebrow>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999,
          fontSize: 10, fontWeight: 700, fontVariantNumeric: "tabular-nums",
          color: diff < 0 ? Z.debt : Z.income,
          border: `1px solid ${diff < 0 ? "rgba(224,85,69,0.35)" : "rgba(92,184,138,0.35)"}`,
          background: diff < 0 ? "rgba(224,85,69,0.08)" : "rgba(92,184,138,0.08)",
        }}>
          {diff < 0 ? `faltan ${fmtCOP(-diff)}` : `sobran ${fmtCOP(diff)}`} /mes
        </span>
      </div>
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
        <AllocBar label="Necesidades" scenV={a.nec} curV={PALLOC.cur.nec} target={PALLOC.targets.nec} color={Z.sage} />
        <AllocBar label="Gustos" scenV={a.gusto} curV={PALLOC.cur.gusto} target={PALLOC.targets.gusto} color={Z.brass} />
        <AllocBar label="Ahorro" scenV={a.ahorro} curV={PALLOC.cur.ahorro} target={PALLOC.targets.ahorro} color={Z.income} />
      </div>
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${Z.border}`, fontSize: 10.5, color: Z.sageDark, lineHeight: 1.5 }}>
        {fits
          ? <span>Necesidades queda en <span style={{ color: Z.debt, fontWeight: 600 }}>79%</span> — lejos de la meta del 50%, pero el total cabe en tu ingreso. Gustos y ahorro absorben el recorte.</span>
          : <span>Arriendo y servicios suben Necesidades de 32% a <span style={{ color: Z.debt, fontWeight: 600 }}>79%</span>. El total supera tu ingreso: hay que recortar gustos o pausar ahorro.</span>}
      </div>
      {!fits && (
        <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PCUTS.slice(0, 3).map((c) => (
            <span key={c.id} style={{
              display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 999,
              fontSize: 10, fontWeight: 600, color: SCEN.c, cursor: "pointer",
              border: `1px solid ${SCEN.borderSoft}`, background: SCEN.bg,
            }}>
              <ZIcon d={PIcons.scissors} size={10} />
              {c.name.replace("Aplazar ", "")} −{fmtM(c.alivio)}
            </span>
          ))}
        </div>
      )}
    </ZCard>
  );
}

// ── C3 · Barra fija + hoja de detalle ─────────────────────────
function VerdictC3Bar() {
  return (
    <div style={{
      borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
      border: "1px solid rgba(224,85,69,0.30)",
      background: "linear-gradient(180deg, rgba(224,85,69,0.10), rgba(17,17,17,0.97))",
      cursor: "pointer",
    }}>
      <ZIcon d={PIcons.alertTri} size={15} style={{ color: Z.debt }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: Z.debt, fontVariantNumeric: "tabular-nums" }}>Te faltan {fmtCOP(PTOT.falta)}/mes</div>
        <div style={{ fontSize: 10, color: Z.sageDark }}>Toca para ver por qué y dónde recortar</div>
      </div>
      <Chevron open={false} size={15} />
    </div>
  );
}

function VerdictC3() {
  return (
    <React.Fragment>
      <StateTag>Colapsado · barra fija sobre el editor</StateTag>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, opacity: 0.85 }}>
        {PCATS.slice(0, 3).map((c) => <EditorRow key={c.id} cat={c} value={EDIT_INIT[c.id]} onChange={() => {}} />)}
      </div>
      <VerdictC3Bar />

      <StateTag>Expandido · hoja con la cuenta y recortes</StateTag>
      <PSheet behind={
        <React.Fragment>
          <BannerScen />
          {PCATS.slice(0, 4).map((c) => <EditorRow key={c.id} cat={c} value={EDIT_INIT[c.id]} onChange={() => {}} />)}
        </React.Fragment>
      }>
        <VerdictHero falta={PTOT.falta} />
        <div style={{ marginTop: 10 }}>
          <BreakdownRow label="Presupuesto del escenario" sub={`${fmtCOP(PTOT.scen)} de ${fmtCOP(PINGRESO)}`} v={PTOT.brechaPresupuesto} />
          <BreakdownRow label="Sobregasto real esperado" sub="prom 3m sobre presupuesto" v={PTOT.sobregasto} />
          <BreakdownRow label="Reserva de arranque" sub="6 meses" v={PTOT.reservaArranque} />
        </div>
        <div style={{ marginTop: 12 }}>
          <Eyebrow>Dónde recortar</Eyebrow>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {PCUTS.slice(0, 3).map((c) => <CutRow key={c.id} cut={c} applied={false} onToggle={() => {}} />)}
          </div>
        </div>
      </PSheet>
    </React.Fragment>
  );
}

Object.assign(window, { VerdictC1, VerdictC2, VerdictC3, VerdictHero, BreakdownRow, CutRow });
