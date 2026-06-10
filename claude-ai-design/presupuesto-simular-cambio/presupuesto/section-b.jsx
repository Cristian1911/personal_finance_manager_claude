// Sección B — Editor del escenario (3 variantes)
const { useState: useStateSB } = React;

// Estado editable de demo: nuevos agregados, Mercado sube, Restaurantes recortado
const EDIT_INIT = {
  arriendo: 1500000, servicios: 220000, internet: 95000,
  mercado: 650000, transporte: 280000, restaurantes: 150000,
  suscripciones: 95000, salidas: 250000, deudas: 815000, ahorro: 600000,
};

function editorTotal(vals) {
  return Object.values(vals).reduce((a, b) => a + b, 0);
}

// Monto editable: toca → input numérico
function EditAmount({ value, onChange, locked }) {
  const [editing, setEditing] = useStateSB(false);
  const [draft, setDraft] = useStateSB("");
  if (locked) return <Num v={fmtCOP(value)} size={14} weight={600} color={Z.sageLight} />;
  if (!editing) {
    return (
      <button onClick={() => { setDraft(String(value)); setEditing(true); }} style={{
        border: "1px solid transparent", background: "transparent", cursor: "pointer", padding: "2px 4px",
        borderRadius: 7, fontFamily: "var(--font-sans)", transition: "background 150ms",
      }} title="Tocar para editar">
        <Num v={fmtCOP(value)} size={14} weight={700} style={{ borderBottom: `1px dashed ${SCEN.borderSoft}`, paddingBottom: 1 }} />
      </button>
    );
  }
  const commit = () => { const n = parseInt(draft || "0", 10); onChange(isNaN(n) ? value : n); setEditing(false); };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 2, padding: "3px 8px",
        borderRadius: 8, border: `1px solid ${SCEN.border}`, background: "rgba(0,0,0,0.35)",
      }}>
        <span style={{ fontSize: 12, color: Z.sageDark }}>$</span>
        <input autoFocus inputMode="numeric" value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
          onBlur={commit}
          style={{
            width: 76, background: "transparent", border: "none", outline: "none",
            color: Z.white, fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums",
            fontFamily: "var(--font-sans)",
          }} />
      </span>
      <button onMouseDown={(e) => { e.preventDefault(); commit(); }} style={{
        width: 24, height: 24, borderRadius: 7, border: `1px solid ${SCEN.border}`,
        background: SCEN.bgStrong, color: SCEN.c, cursor: "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}><ZIcon d={PIcons.check} size={12} sw={2.5} /></button>
    </span>
  );
}

// Fila del editor: actual → escenario · delta · ancla prom 3m
function EditorRow({ cat, value, onChange }) {
  const delta = cat.cur == null ? null : value - cat.cur;
  const changed = delta !== null && delta !== 0;
  return (
    <ZRow style={{ padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: Z.white, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat.name}</span>
          {cat.nuevo && <NuevoBadge />}
          {cat.fijo && <FijoBadge />}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {changed && (
            <Num v={fmtCOP(cat.cur)} size={11} weight={500} color={Z.sageDark} style={{ textDecoration: "line-through", textDecorationColor: "rgba(147,140,126,0.5)" }} />
          )}
          {changed && (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={Z.sageDark} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
          )}
          <EditAmount value={value} onChange={onChange} locked={cat.fijo} />
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
        <PromLine prom={cat.prom} scen={value} />
        {cat.cur == null ? <DeltaChip v={value} /> : changed ? <DeltaChip v={delta} /> : <span style={{ fontSize: 10, color: "rgba(147,140,126,0.6)" }}>igual</span>}
      </div>
    </ZRow>
  );
}

// Total pegado al pie del editor
function EditorFooter({ total }) {
  const diff = PINGRESO - total;
  const falta = diff < 0;
  return (
    <div style={{
      borderRadius: 14, border: `1px solid ${falta ? "rgba(224,85,69,0.30)" : "rgba(92,184,138,0.30)"}`,
      background: "rgba(17,17,17,0.95)", padding: "10px 14px", position: "sticky", bottom: 8,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: Z.sageDark }}>Total escenario</span>
        <Num v={fmtCOP(total)} size={17} weight={700} />
      </div>
      <div style={{ marginTop: 7, position: "relative" }}>
        <UsageBar pct={(total / Math.max(total, PINGRESO)) * 100} color={falta ? Z.debt : Z.income} height={4} />
        <div style={{ position: "absolute", top: -2, bottom: -2, left: `${(PINGRESO / Math.max(total, PINGRESO)) * 100}%`, width: 2, borderRadius: 1, background: "rgba(246,240,227,0.55)" }}></div>
      </div>
      <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", fontSize: 10, fontVariantNumeric: "tabular-nums" }}>
        <span style={{ color: Z.sageDark }}>Ingreso {fmtCOP(PINGRESO)}</span>
        <span style={{ color: falta ? Z.debt : Z.income, fontWeight: 700 }}>
          {falta ? `−${fmtCOP(-diff)} sobre tu ingreso` : `${fmtCOP(diff)} libres`}
        </span>
      </div>
    </div>
  );
}

// ── B1 · Lista plana, edición en línea ────────────────────────
function EditorB1() {
  const [vals, setVals] = useStateSB(EDIT_INIT);
  const set = (id) => (n) => setVals({ ...vals, [id]: n });
  return (
    <React.Fragment>
      <BannerScen />
      <MonthSel />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {PCATS.map((c) => <EditorRow key={c.id} cat={c} value={vals[c.id]} onChange={set(c.id)} />)}
      </div>
      <button style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 7, height: 38,
        borderRadius: 12, border: `1px dashed ${SCEN.borderSoft}`, background: "transparent",
        color: SCEN.c, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)",
      }}>
        <ZIcon d={PIcons.plus} size={13} sw={2.5} /> Agregar categoría
      </button>
      <EditorFooter total={editorTotal(vals)} />
    </React.Fragment>
  );
}

// ── B2 · Agrupado: Nuevos / Cambian / Igual ───────────────────
function GroupHeader({ label, sub, count }) {
  return (
    <div className="z-divider" style={{ marginTop: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: Z.sageDark, whiteSpace: "nowrap" }}>
        {label} <span style={{ color: "rgba(147,140,126,0.6)" }}>· {count}</span>
      </span>
      <span className="line"></span>
      <span style={{ fontSize: 10, color: Z.sageLight, fontVariantNumeric: "tabular-nums", fontWeight: 600, whiteSpace: "nowrap" }}>{sub}</span>
    </div>
  );
}

function EditorB2() {
  const [vals, setVals] = useStateSB(EDIT_INIT);
  const [igualOpen, setIgualOpen] = useStateSB(false);
  const set = (id) => (n) => setVals({ ...vals, [id]: n });
  const byId = Object.fromEntries(PCATS.map((c) => [c.id, c]));
  const nuevos = PCATS.filter((c) => c.nuevo);
  const cambian = PCATS.filter((c) => !c.nuevo && vals[c.id] !== c.cur);
  const igual = PCATS.filter((c) => !c.nuevo && vals[c.id] === c.cur);
  const sum = (list) => list.reduce((a, c) => a + vals[c.id], 0);
  const deltaCambian = cambian.reduce((a, c) => a + (vals[c.id] - c.cur), 0);
  return (
    <React.Fragment>
      <BannerScen />
      <MonthSel />

      <GroupHeader label="Nuevos gastos" count={nuevos.length} sub={`+${fmtCOP(sum(nuevos))}`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {nuevos.map((c) => <EditorRow key={c.id} cat={c} value={vals[c.id]} onChange={set(c.id)} />)}
      </div>

      <GroupHeader label="Cambian" count={cambian.length} sub={`${deltaCambian >= 0 ? "+" : "−"}${fmtCOP(Math.abs(deltaCambian))} neto`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {cambian.map((c) => <EditorRow key={c.id} cat={c} value={vals[c.id]} onChange={set(c.id)} />)}
      </div>

      <GroupHeader label="Igual" count={igual.length} sub={fmtCOP(sum(igual))} />
      <button onClick={() => setIgualOpen(!igualOpen)} style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6, height: 32,
        borderRadius: 10, border: `1px solid ${Z.border}`, background: "rgba(0,0,0,0.15)",
        color: Z.sageDark, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)",
      }}>
        {igualOpen ? "Ocultar" : "Mostrar"} {igual.length} categorías sin cambios
        <Chevron open={igualOpen} size={13} />
      </button>
      <Expand open={igualOpen}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {igual.map((c) => <EditorRow key={c.id} cat={c} value={vals[c.id]} onChange={set(c.id)} />)}
        </div>
      </Expand>

      <EditorFooter total={editorTotal(vals)} />
    </React.Fragment>
  );
}

// ── B3 · Ancla de realidad como barra ─────────────────────────
// Barra: relleno = prom 3m (lo que realmente gastas) · marca = presupuesto escenario
function RealityRow({ cat, value }) {
  const max = Math.max(cat.prom || 0, value) * 1.15;
  const delta = cat.cur == null ? null : value - cat.cur;
  const overReal = cat.prom != null && cat.prom > value;
  return (
    <ZRow style={{ padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: Z.white }}>{cat.name}</span>
          {cat.nuevo && <NuevoBadge />}
          {cat.fijo && <FijoBadge />}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {delta !== null && delta !== 0 && <DeltaChip v={delta} />}
          <Num v={fmtCOP(value)} size={14} weight={700} />
        </span>
      </div>
      <div style={{ marginTop: 8, position: "relative", height: 8, borderRadius: 999, background: "rgba(255,255,255,0.06)" }}>
        {cat.prom != null && (
          <div style={{
            position: "absolute", top: 1, left: 0, height: 6, borderRadius: 999,
            width: `${(cat.prom / max) * 100}%`,
            background: overReal ? "rgba(212,168,67,0.55)" : "rgba(118,128,83,0.55)",
          }}></div>
        )}
        <div style={{ position: "absolute", top: -2, bottom: -2, left: `${(value / max) * 100}%`, width: 2, borderRadius: 1, background: Z.white }}></div>
      </div>
      <div style={{ marginTop: 5, display: "flex", justifyContent: "space-between", fontSize: 9, fontVariantNumeric: "tabular-nums" }}>
        <span style={{ color: overReal ? Z.alert : Z.sageDark }}>
          {cat.prom == null ? "sin historial — estimado" : `gastas ${fmtCOP(cat.prom)} prom 3m`}
        </span>
        <span style={{ color: Z.sageDark }}>presupuesto │</span>
      </div>
    </ZRow>
  );
}

function EditorB3() {
  const vals = EDIT_INIT;
  const destacadas = ["arriendo", "mercado", "restaurantes", "transporte", "salidas"];
  const resto = PCATS.filter((c) => !destacadas.includes(c.id));
  return (
    <React.Fragment>
      <BannerScen />
      <div style={{ fontSize: 11, color: Z.sageDark, lineHeight: 1.5 }}>
        La barra muestra tu gasto real (prom 3m) contra el presupuesto del escenario (│). Si la barra pasa la marca, el plan choca con tus hábitos.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {destacadas.map((id) => {
          const c = PCATS.find((x) => x.id === id);
          return <RealityRow key={id} cat={c} value={vals[id]} />;
        })}
      </div>
      <div className="z-divider">
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: Z.sageDark }}>Sin fricción</span>
        <span className="line"></span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {resto.map((c) => <RealityRow key={c.id} cat={c} value={vals[c.id]} />)}
      </div>
      <EditorFooter total={editorTotal(vals)} />
    </React.Fragment>
  );
}

Object.assign(window, { EditorB1, EditorB2, EditorB3, EditorRow, EditorFooter, EDIT_INIT });
