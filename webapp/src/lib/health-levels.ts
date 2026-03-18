import type { CurrencyCode } from "@/types/domain";

export type Level = "excelente" | "solido" | "atento" | "alto" | "critico";
export type MeterType = "gasto" | "deuda" | "ahorro" | "colchon";

// ---------------------------------------------------------------------------
// classifyLevel
// ---------------------------------------------------------------------------

export function classifyLevel(meter: MeterType, value: number): Level {
  switch (meter) {
    case "gasto":
      if (value < 50) return "excelente";
      if (value < 60) return "solido";
      if (value < 70) return "atento";
      if (value < 85) return "alto";
      return "critico";

    case "deuda":
      if (value < 15) return "excelente";
      if (value < 25) return "solido";
      if (value < 36) return "atento";
      if (value < 43) return "alto";
      return "critico";

    case "ahorro":
      if (value > 35) return "excelente";
      if (value >= 20) return "solido";
      if (value >= 10) return "atento";
      if (value >= 5) return "alto";
      return "critico";

    case "colchon":
      if (value > 12) return "excelente";
      if (value >= 6) return "solido";
      if (value >= 3) return "atento";
      if (value >= 1) return "alto";
      return "critico";
  }
}

// ---------------------------------------------------------------------------
// getLevelColor
// ---------------------------------------------------------------------------

export function getLevelColor(level: Level): string {
  switch (level) {
    case "excelente": return "var(--z-excellent)";
    case "solido":    return "var(--z-income)";
    case "atento":    return "var(--z-alert)";
    case "alto":      return "var(--z-expense)";
    case "critico":   return "var(--z-debt)";
  }
}

// ---------------------------------------------------------------------------
// getLevelTag
// ---------------------------------------------------------------------------

export function getLevelTag(level: Level): string {
  switch (level) {
    case "excelente": return "EXCELENTE";
    case "solido":    return "SOLIDO";
    case "atento":    return "ATENTO";
    case "alto":      return "ALTO";
    case "critico":   return "CRITICO";
  }
}

// ---------------------------------------------------------------------------
// getNormalizedPosition — returns 0-100 for pin positioning on gradient bar
// ---------------------------------------------------------------------------

export function getNormalizedPosition(meter: MeterType, value: number): number {
  let position: number;

  switch (meter) {
    case "gasto": {
      // 0% expense ratio → 0 (best), 100%+ → 100 (worst)
      // Meaningful range: 0–100%
      position = Math.min(100, Math.max(0, value));
      break;
    }
    case "deuda": {
      // 0% DTI → 0 (best), 60%+ → 100 (worst)
      // Clip meaningful range at 60% (well beyond critico threshold of 43%)
      const MAX_DTI = 60;
      position = Math.min(100, Math.max(0, (value / MAX_DTI) * 100));
      break;
    }
    case "ahorro": {
      // higher = better → invert. 0% savings → 100 (worst), 40%+ → 0 (best)
      const MAX_SAVINGS = 40;
      const raw = Math.min(MAX_SAVINGS, Math.max(0, value));
      position = 100 - (raw / MAX_SAVINGS) * 100;
      break;
    }
    case "colchon": {
      // higher = better → invert. 0 months → 100 (worst), 15+ months → 0 (best)
      const MAX_MONTHS = 15;
      const raw = Math.min(MAX_MONTHS, Math.max(0, value));
      position = 100 - (raw / MAX_MONTHS) * 100;
      break;
    }
  }

  return Math.round(position);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type IncomeRange = "low" | "mid" | "high";

function incomeRange(monthlyIncome: number): IncomeRange {
  if (monthlyIncome < 4_000_000) return "low";
  if (monthlyIncome <= 10_000_000) return "mid";
  return "high";
}

function fmt(amount: number, currency: CurrencyCode = "COP"): string {
  const locales: Record<CurrencyCode, string> = {
    COP: "es-CO", BRL: "pt-BR", MXN: "es-MX", USD: "en-US",
    EUR: "de-DE", PEN: "es-PE", CLP: "es-CL", ARS: "es-AR",
  };
  const decimals: Record<CurrencyCode, number> = {
    COP: 0, BRL: 2, MXN: 2, USD: 2,
    EUR: 2, PEN: 2, CLP: 0, ARS: 2,
  };
  return new Intl.NumberFormat(locales[currency], {
    style: "currency",
    currency,
    minimumFractionDigits: decimals[currency],
    maximumFractionDigits: decimals[currency],
  }).format(amount);
}

function pct(value: number): string {
  return `${value.toFixed(1).replace(/\.0$/, "")}%`;
}

// ---------------------------------------------------------------------------
// Roast messages — deterministic selection via value buckets
// ---------------------------------------------------------------------------

type RoastContext = {
  meter: MeterType;
  value: number;
  level: Level;
  monthlyIncome?: number | null;
  currency?: CurrencyCode;
};

function roastGasto(ctx: RoastContext): string {
  const { value, level, monthlyIncome, currency = "COP" } = ctx;

  if (monthlyIncome != null && monthlyIncome > 0) {
    const expenses = monthlyIncome * (value / 100);
    const remaining = monthlyIncome - expenses;
    const range = incomeRange(monthlyIncome);

    if (level === "critico") {
      if (range === "low") {
        return `Gastas ${pct(value)} de lo que ganas. Con ingresos ajustados, este nivel de gasto no deja margen — te queda solo ${fmt(remaining, currency)} al mes para todo lo demas.`;
      }
      if (range === "mid") {
        return `Gastas ${fmt(expenses, currency)} de los ${fmt(monthlyIncome, currency)} que ganas. Para alguien con tu salario, esto es preocupante — tu margen de maniobra es de solo ${fmt(remaining, currency)} al mes.`;
      }
      // high
      return `Ganas bien y aun asi gastas el ${pct(value)}. Esto no es falta de ingreso — es falta de control. Te sobran ${fmt(remaining, currency)} pero el patron no cambia solo.`;
    }

    if (level === "alto") {
      if (range === "high") {
        return `Lifestyle creep clasico. Ganas lo suficiente para ahorrar mucho mas, pero el ${pct(value)} se va en gastos. Cada aumento de sueldo se lo come el gasto.`;
      }
      if (range === "mid") {
        return `El ${pct(value)} en gastos es demasiado para tu nivel de ingreso. Si sube un gasto fijo, te quedas sin colchon. Tienes ${fmt(remaining, currency)} de margen — eso no alcanza para imprevistos.`;
      }
      // low
      return `Con ingreso limitado, gastar el ${pct(value)} te deja expuesto. Cualquier imprevisto y entras en rojo. Solo te quedan ${fmt(remaining, currency)}.`;
    }

    if (level === "atento") {
      if (range === "high") {
        return `El ${pct(value)} en gastos es manejable, pero para tu nivel de ingreso deberias estar ahorrando mucho mas. Hay margen que no estas aprovechando.`;
      }
      return `Gastos en ${pct(value)} — no es alarma todavia, pero estas cerca del limite donde el ahorro se vuelve dificil. Tienes ${fmt(remaining, currency)} disponibles; cuida que no se evaporen.`;
    }

    if (level === "solido") {
      return `Gastas el ${pct(value)} — controlado. Te quedan ${fmt(remaining, currency)} para ahorro e imprevistos. Mantener esto es la base de todo lo demas.`;
    }

    // excelente
    return `Solo el ${pct(value)} en gastos. Disciplina real — te sobran ${fmt(remaining, currency)} para construir patrimonio. Muy pocos llegan a esto.`;
  }

  // No income available — generic messages by level
  switch (level) {
    case "critico":
      return `El ${pct(value)} de tus ingresos en gastos es critico. No hay margen para imprevistos ni para ahorrar. Esto necesita atencion inmediata.`;
    case "alto":
      return `El ${pct(value)} en gastos es alto — estas cerca del limite. Pequenos ajustes ahora evitan problemas grandes despues.`;
    case "atento":
      return `El ${pct(value)} en gastos — no es urgente, pero tampoco es para ignorar. Hay espacio para optimizar.`;
    case "solido":
      return `El ${pct(value)} en gastos es un nivel solido. Mantener esta disciplina es lo que separa a quien ahorra de quien no.`;
    case "excelente":
      return `Solo el ${pct(value)} en gastos — excelente control. Eso es lo que permite construir ahorro real.`;
  }
}

function roastDeuda(ctx: RoastContext): string {
  const { value, level, monthlyIncome, currency = "COP" } = ctx;

  if (level === "critico") {
    const delta = (value - 43).toFixed(1);
    if (monthlyIncome != null && monthlyIncome > 0) {
      const debtPayment = monthlyIncome * (value / 100);
      return `Tu deuda consume el ${pct(value)} de tu ingreso — ${fmt(debtPayment, currency)} al mes que no puedes usar para nada mas. Los bancos cortan en 36%. Estas ${delta} puntos por encima del limite.`;
    }
    return `Tu deuda consume el ${pct(value)} de tu ingreso. Los bancos cortan en 36%. Estas ${delta} puntos por encima del limite. Zona de riesgo real.`;
  }

  if (level === "alto") {
    const delta = (43 - value).toFixed(1);
    if (monthlyIncome != null && monthlyIncome > 0) {
      const debtPayment = monthlyIncome * (value / 100);
      return `${fmt(debtPayment, currency)} al mes en deuda — el ${pct(value)} de tu ingreso. Estas a solo ${delta} puntos del umbral critico. No tomes mas credito ahora.`;
    }
    return `El ${pct(value)} en deuda — a ${delta} puntos del umbral donde los bancos te cierran el credito. No es momento de asumir nuevas obligaciones.`;
  }

  if (level === "atento") {
    return `El ${pct(value)} en deuda es manejable, pero ya estas en la mitad del camino hacia el limite critico. Cada nueva deuda que agregas pesa mas de lo que parece.`;
  }

  if (level === "solido") {
    return `DTI en ${pct(value)} — bajo control. Tienes capacidad de credito sin riesgo real. Usa esa ventaja con cabeza.`;
  }

  // excelente
  if (value < 5) {
    return `Casi sin deuda — ${pct(value)}. Eso es libertad financiera real. Tus ingresos trabajan para ti, no para los bancos.`;
  }
  return `Solo el ${pct(value)} en deuda. Nivel excelente — tienes el maximo margen para moverte si surge una oportunidad o un imprevisto.`;
}

function roastAhorro(ctx: RoastContext): string {
  const { value, level, monthlyIncome, currency = "COP" } = ctx;

  if (monthlyIncome != null && monthlyIncome > 0) {
    const savings = monthlyIncome * (value / 100);
    const range = incomeRange(monthlyIncome);
    const monthsTo6 = value > 0 ? Math.ceil((monthlyIncome * 6) / savings) : null;

    if (level === "critico") {
      if (range === "low") {
        return `Ahorras solo el ${pct(value)} — con ingreso ajustado, esto es comprensible, pero igual es riesgoso. Sin colchon, cualquier imprevisto se vuelve deuda.`;
      }
      if (range === "mid") {
        return `Solo ${fmt(savings, currency)} al mes en ahorro — el ${pct(value)} de lo que ganas. Para tu nivel de ingreso esto es muy poco. Un gasto inesperado y entras en deuda.`;
      }
      return `Ganas bien y ahorras solo el ${pct(value)}. Eso es ${fmt(savings, currency)} al mes — casi nada para lo que ingresas. El gasto se come todo.`;
    }

    if (level === "alto") {
      if (monthsTo6 != null) {
        return `El ${pct(value)} ahorrado — por debajo del 10% recomendado. A este ritmo necesitas ${monthsTo6} meses para tener 6 meses de colchon. Cualquier ajuste ayuda.`;
      }
      return `El ${pct(value)} ahorrado es insuficiente. Estas por debajo del minimo recomendado y sin margen real para emergencias.`;
    }

    if (level === "atento") {
      return `El ${pct(value)} en ahorro — dentro del rango aceptable pero no del bueno. Aumentar 5 puntos mas marca la diferencia entre tener colchon y no tenerlo.`;
    }

    if (level === "solido") {
      const monthsToTarget = monthsTo6 != null && monthsTo6 > 0 ? monthsTo6 : null;
      if (monthsToTarget != null && monthsToTarget <= 12) {
        return `Ahorras el ${pct(value)} — por encima del 20% recomendado. A este ritmo tienes 6 meses de colchon en ${monthsToTarget} meses. Vas bien.`;
      }
      return `El ${pct(value)} en ahorro es solido — por encima del benchmark del 20%. Mantener esto construye patrimonio real con el tiempo.`;
    }

    // excelente
    return `El ${pct(value)} en ahorro — eso es ${fmt(savings, currency)} al mes que van a construir algo real. Muy pocos mantienen este nivel. No lo bajes.`;
  }

  // Generic
  switch (level) {
    case "critico":
      return `Solo el ${pct(value)} en ahorro — nivel critico. Sin reservas, el primer imprevisto se convierte en deuda. Necesitas cambiar esto antes que cualquier otra cosa.`;
    case "alto":
      return `El ${pct(value)} ahorrado es bajo. Estas debajo del 10% minimo recomendado. Pequenos recortes en gasto pueden mover este numero rapido.`;
    case "atento":
      return `El ${pct(value)} en ahorro — no es malo, pero tampoco da tranquilidad. Llegar al 20% cambia cuanto tardas en tener un colchon real.`;
    case "solido":
      return `Ahorras el ${pct(value)} — por encima del 20% recomendado. Mantener esto ${value >= 25 ? "varios" : "algunos"} meses mas y vas a tener colchon real.`;
    case "excelente":
      return `El ${pct(value)} en ahorro es excepcional. Eso pone tu dinero a trabajar, no solo a sobrevivir el mes.`;
  }
}

function roastColchon(ctx: RoastContext): string {
  const { value, level, monthlyIncome, currency = "COP" } = ctx;

  if (level === "critico") {
    if (monthlyIncome != null && monthlyIncome > 0) {
      const balance = monthlyIncome * value;
      return `Tienes ${fmt(balance, currency)} liquidos — menos de un mes de gastos. Si pierdes el ingreso hoy, en semanas estas en ceros. Esto es urgente.`;
    }
    return `Menos de un mes de colchon. Si el ingreso se detiene hoy, en dias entras en problemas. Construir reserva es la prioridad numero uno.`;
  }

  if (level === "alto") {
    const months = value.toFixed(1).replace(/\.0$/, "");
    if (monthlyIncome != null && monthlyIncome > 0) {
      const balance = monthlyIncome * value;
      const monthsNeeded = Math.ceil(6 - value);
      return `Tienes ${fmt(balance, currency)} — ${months} meses de cobertura. Estas en la zona fragil. Necesitas ${monthsNeeded} meses mas de ahorro para llegar a un nivel seguro.`;
    }
    return `${months} meses de colchon — funciona para imprevistos menores, pero no para perder el ingreso. La meta real son 6 meses.`;
  }

  if (level === "atento") {
    const months = value.toFixed(1).replace(/\.0$/, "");
    if (monthlyIncome != null && monthlyIncome > 0) {
      const balance = monthlyIncome * value;
      const monthsExpenses = monthlyIncome; // approximate monthly expenses ≈ income for message
      return `Tienes ${fmt(balance, currency)} liquidos contra ~${fmt(monthsExpenses, currency)}/mes. ${months} meses de cobertura — suficiente para aguantar, no para estar tranquilo.`;
    }
    return `${months} meses de colchon — te cubre para emergencias menores pero no para una crisis de ingreso larga. Sigue acumulando.`;
  }

  if (level === "solido") {
    const months = value.toFixed(1).replace(/\.0$/, "");
    return `${months} meses de colchon — estas dentro del rango solido. Tienes margen real para aguantar un cambio de trabajo o un imprevisto grande sin entrar en panico.`;
  }

  // excelente
  const months = Math.floor(value);
  return `Mas de ${months} meses de colchon. Eso es libertad de decision — puedes cambiar de trabajo, tomar riesgos calculados o aguantar una crisis larga sin comprometer tu estabilidad.`;
}

// ---------------------------------------------------------------------------
// getRoastMessage — public API
// ---------------------------------------------------------------------------

export function getRoastMessage(
  meter: MeterType,
  value: number,
  level: Level,
  monthlyIncome?: number | null,
  currency?: CurrencyCode,
): string {
  const ctx: RoastContext = { meter, value, level, monthlyIncome, currency };

  switch (meter) {
    case "gasto":   return roastGasto(ctx);
    case "deuda":   return roastDeuda(ctx);
    case "ahorro":  return roastAhorro(ctx);
    case "colchon": return roastColchon(ctx);
  }
}
