// Sección D — Gastos de arranque (compras one-time) · 2 variantes
const { useState: useStateSD } = React;

const ARR_ICONS = { cocina: PIcons.chefhat, nevera: PIcons.fridge, muebles: PIcons.sofa };

function DeseoBadge() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: Z.brass, flexShrink: 0 }}>
      <ZIcon d={PIcons.heart} size={10} /> de Deseos
    </span>
  );
}

// ── D1 · Lista con plan de fondeo ─────────────────────────────
function ArranqueItem({ item, plan }) {
  return (
    <ZRow style={{ padding: "11px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: "rgba(255,255,255,0.04)", border: `1px solid ${Z.border}`, color: Z.sageLight,
        }}>
          <ZIcon d={ARR_ICONS[item.id]} size={15} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: Z.white, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</span>
            {item.deseo && <DeseoBadge />}
          </div>
          <div style={{ marginTop: 2 }}><AffordChip verdict={item.verdict} /></div>
        </div>
        <Num v={fmtCOP(item.monto)} size={14} weight={700} style={{ flexShrink: 0 }} />
      </div>
      <div style={{
        marginTop: 8, paddingTop: 7, borderTop: `1px solid ${Z.border}`,
        display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: plan.ok ? Z.income : Z.sageLight,
      }}>
        <ZIcon d={plan.ok ? PIcons.check : PIcons.calendar} size={11} sw={2} style={{ color: plan.ok ? Z.income : Z.sageDark }} />
        <span style={{ lineHeight: 1.4 }}>{plan.text}</span>
      </div>
    </ZRow>
  );
}

function ArranqueD1() {
  const planes = {
    cocina: { ok: true, text: "Tu colchón la cubre hoy" },
    nevera: { ok: true, text: `Cubierta con tu colchón — quedan ${fmtCOP(PCOLCHON - 450000 - 1200000)} de margen` },
    muebles: { ok: false, text: `Te faltan ${fmtCOP(1750000)} → 5 meses ahorrando ${fmtCOP(400000)}/mes` },
  };
  return (
    <React.Fragment>
      <BannerScen />
      <ZCard>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Eyebrow>Gastos de arranque</Eyebrow>
          <span style={{ fontSize: 10, color: Z.sageDark }}>una sola vez</span>
        </div>
        <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: 8 }}>
          <Num v={fmtCOP(PARR_TOTAL)} size={26} weight={800} />
          <span style={{ fontSize: 11, color: Z.sageDark }}>· 3 compras</span>
        </div>
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: Z.sageLight }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: Z.income, flexShrink: 0 }}></span>
          Con tu colchón actual ({fmtCOP(PCOLCHON)}) cubres 2 de 3
        </div>
        <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: Z.sageLight }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: SCEN.c, flexShrink: 0 }}></span>
          Colchón + {fmtCOP(400000)}/mes: todo listo en 5 meses
        </div>
      </ZCard>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {PARRANQUE.map((it) => <ArranqueItem key={it.id} item={it} plan={planes[it.id]} />)}
      </div>
      <button style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 7, height: 38,
        borderRadius: 12, border: `1px dashed ${SCEN.borderSoft}`, background: "transparent",
        color: SCEN.c, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)",
      }}>
        <ZIcon d={PIcons.plus} size={13} sw={2.5} /> Agregar gasto de arranque
      </button>
    </React.Fragment>
  );
}

// ── D2 · Línea de tiempo de fondeo (interactiva) ──────────────
const MESES_LBL = ["hoy", "jul", "ago", "sep", "oct", "nov", "dic", "ene", "feb", "mar"];

function readyMonth(cumNeed, rate, colchon) {
  const need = cumNeed - (colchon ? PCOLCHON : 0);
  if (need <= 0) return 0;
  return Math.ceil(need / rate);
}

function ArranqueD2() {
  const [rate, setRate] = useStateSD(400000);
  const [colchon, setColchon] = useStateSD(true);
  let cum = 0;
  const items = PARRANQUE.map((it) => {
    cum += it.monto;
    return { ...it, mes: readyMonth(cum, rate, colchon) };
  });
  const maxMes = Math.max(...items.map((i) => i.mes), 1);
  const span = Math.min(MESES_LBL.length - 1, Math.max(maxMes, 5));
  const tone = (v) => AFFORD_TONES[v].c;

  return (
    <React.Fragment>
      <BannerScen />
      <ZCard>
        <Eyebrow>Plan de fondeo</Eyebrow>
        <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: 8 }}>
          <Num v={fmtCOP(PARR_TOTAL)} size={22} weight={800} />
          <span style={{ fontSize: 11, color: maxMes === 0 ? Z.income : Z.sageLight }}>
            todo listo {maxMes === 0 ? "hoy" : `en ${maxMes} ${maxMes === 1 ? "mes" : "meses"} (${MESES_LBL[Math.min(maxMes, MESES_LBL.length - 1)]})`}
          </span>
        </div>

        {/* controles */}
        <div style={{ marginTop: 12, display: "flex", gap: 4, padding: 3, borderRadius: 11, border: `1px solid ${Z.border}`, background: "rgba(0,0,0,0.25)" }}>
          {[300000, 400000, 500000].map((r) => (
            <button key={r} onClick={() => setRate(r)} style={{
              flex: 1, height: 28, borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
              fontFamily: "var(--font-sans)", fontVariantNumeric: "tabular-nums",
              border: rate === r ? "1px solid rgba(147,120,68,0.35)" : "1px solid transparent",
              background: rate === r ? Z.surface3 : "transparent",
              color: rate === r ? Z.white : Z.sageDark, transition: "background 150ms, color 150ms",
            }}>{fmtM(r)}/mes</button>
          ))}
        </div>
        <button onClick={() => setColchon(!colchon)} style={{
          marginTop: 8, width: "100%", display: "flex", alignItems: "center", gap: 8,
          padding: "8px 11px", borderRadius: 10, cursor: "pointer", fontFamily: "var(--font-sans)",
          border: `1px solid ${colchon ? "rgba(92,184,138,0.30)" : Z.border}`,
          background: colchon ? "rgba(92,184,138,0.06)" : "rgba(0,0,0,0.15)",
          transition: "background 150ms, border-color 150ms",
        }}>
          <span style={{
            width: 28, height: 16, borderRadius: 999, position: "relative", flexShrink: 0,
            background: colchon ? Z.income : "rgba(255,255,255,0.12)", transition: "background 150ms",
          }}>
            <span style={{
              position: "absolute", top: 2, left: colchon ? 14 : 2, width: 12, height: 12,
              borderRadius: 999, background: Z.ink, transition: "left 150ms",
            }}></span>
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: colchon ? Z.income : Z.sageLight }}>
            Usar colchón actual · {fmtCOP(PCOLCHON)}
          </span>
        </button>

        {/* línea de tiempo */}
        <div style={{ marginTop: 16, position: "relative", height: 2, background: "rgba(255,255,255,0.08)", borderRadius: 1, marginLeft: 6, marginRight: 6 }}>
          {Array.from({ length: span + 1 }).map((_, m) => (
            <span key={m} style={{ position: "absolute", left: `${(m / span) * 100}%`, top: -2, width: 1, height: 6, background: "rgba(255,255,255,0.14)" }}></span>
          ))}
          {items.map((it, idx) => (
            <span key={it.id} title={`${it.name} · ${it.mes === 0 ? "hoy" : MESES_LBL[it.mes]}`} style={{
              position: "absolute", left: `${(Math.min(it.mes, span) / span) * 100}%`, top: -7,
              width: 16, height: 16, borderRadius: 999, transform: "translateX(-50%)",
              background: Z.ink, border: `2px solid ${tone(it.verdict)}`,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              transition: "left 200ms",
            }}></span>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, marginLeft: 6, marginRight: 6 }}>
          {Array.from({ length: span + 1 }).map((_, m) => (
            <span key={m} style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: Z.sageDark }}>{MESES_LBL[m]}</span>
          ))}
        </div>
      </ZCard>

      {/* leyenda por ítem */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((it) => (
          <ZRow key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px" }}>
            <span style={{ width: 9, height: 9, borderRadius: 999, border: `2px solid ${tone(it.verdict)}`, flexShrink: 0 }}></span>
            <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: Z.white, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name}</span>
            <Num v={fmtCOP(it.monto)} size={11.5} weight={600} color={Z.sageLight} />
            <span style={{ fontSize: 11, fontWeight: 700, color: it.mes === 0 ? Z.income : Z.sageLight, fontVariantNumeric: "tabular-nums", width: 52, textAlign: "right", flexShrink: 0 }}>
              {it.mes === 0 ? "hoy" : MESES_LBL[it.mes]}
            </span>
          </ZRow>
        ))}
      </div>
      <div style={{ fontSize: 10, color: Z.sageDark, lineHeight: 1.5 }}>
        Orden de compra sugerido por el veredicto de Deseos: primero lo que el motor aprueba.
      </div>
    </React.Fragment>
  );
}

Object.assign(window, { ArranqueD1, ArranqueD2, DeseoBadge });
