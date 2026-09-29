# Prueba cerrada — Ronda 3 (plan para acceso a producción)

> 2026-09-22 · Google rechazó por segunda vez: *"Testers were not engaged"* +
> *"didn't follow testing best practices … acting on user feedback through
> updates"*. Pide **14 días más** de prueba cerrada con verificadores reales.

## Por qué nos rechazaron (lo que Google realmente mide)

Google no evalúa las funciones de la app. Evalúa lo que **ve desde Play**:

| Señal | Qué ve Google | Estado ronda 2 |
|---|---|---|
| Verificadores | ≥12 con opt-in **continuo** 14 días (salir y volver reinicia el conteo) | Llegamos, pero justo |
| Participación | Aperturas/sesiones de instalaciones hechas **desde Play** | "Cerca de la mitad" abrió seguido — nosotros mismos lo dijimos |
| Actuar sobre feedback | **Versiones nuevas subidas al track cerrado** durante la prueba | Poca o ninguna evidencia visible |
| Feedback | Página *Testing feedback* de Play Console | Todo fue por WhatsApp y `bug_reports` — invisible para Google |

Conclusión: el problema no es de código, es de **cómo se corrió la prueba**. El
plan cambia el comportamiento de los verificadores y deja evidencia que Google
pueda ver.

## Día 0 — preparar (hoy)

- [ ] Play Console → Closed testing → Testers: anotar **cuántos siguen con opt-in hoy**.
      Si ya son ≥12 y no se salen, el reloj de 14 días de ellos sigue corriendo.
- [ ] Play Console → Testing feedback: ¿hay entradas? (probablemente 0 — ese es parte del problema).
- [ ] Meta: **20–25 inscritos** para asegurar 12 activos con rotación.
- [ ] Crear grupo de WhatsApp "Verificadores Zeta" (la guía de Google lo recomienda textual).
- [ ] Subir **1.3.1** al track cerrado (ver cadencia abajo) — que el día 0 ya tenga una versión nueva.

### De dónde salen los verificadores — mezcla recomendada

Los conocidos no siguen instrucciones de forma fiable. Mezcla:

1. **Servicio pago (~$20 USD)** → cubre opt-in continuo ≥12 + aperturas casi diarias.
2. **2–3 conocidos de confianza** con el guion semanal → los reportes reales que justifican 1.3.1 / 1.3.2 / 1.4.0.
3. **Las 3 versiones** al track cerrado igual — un servicio pago NO resuelve "acting on feedback through updates"; hay rechazos reportados aun pagando.

| Servicio | Precio aprox. (2026-09) | Notas |
|---|---|---|
| [PlayStoreTesters](https://playstoretesters.com/) | ~$10 | 16 días, arranca en 2–4 h |
| [Testers Community](https://www.testerscommunity.com/) | desde ~$15 | 15 verificadores, "garantía" |
| [PrimeTestLab](https://primetestlab.com/) | desde ~$19.99 | 12 verificadores, arranca en 4–6 h |
| [TestFi](https://www.testfi.app/) | $39.99 | 12 verificadores "verificados" |

- Pedirles entrar por **"Probar demo sin cuenta"** — no crear cuentas con datos falsos en una app financiera; no van a importar extractos reales.
- **Alternativa estructural:** cuenta de **organización** (exenta de la regla 12×14). Requiere entidad legal (SAS) + D-U-N-S (gratis, puede tardar semanas) + cuenta org ($25) + transferir la app. Solo si igual se va a formalizar Zeta.

### Mensaje de reclutamiento (reemplaza al del kit)

> **Ayúdame a probar Zeta**
> Zeta es una app para organizar tus finanzas en Colombia: importa extractos
> del banco, arma tu presupuesto y te recuerda tus pagos.
> Necesito personas con **Android** que la usen **2 semanas**:
> 1. Únete con este enlace: **[ENLACE DE PRUEBA CERRADA]**
> 2. Instálala **desde Play Store** (no por APK).
> 3. **No te salgas de la prueba durante 14 días**, aunque no la abras un día.
> 4. Cada semana te mando 3 cosas cortas para probar.
> 5. Si algo falla o no te gusta: en la ficha de Play toca **"Enviar comentarios
>    privados al desarrollador"**, o el botón de reporte dentro de la app.

## Cadencia de versiones — la evidencia que faltó

Tres versiones al track cerrado dentro de la ventana. Cada una con notas en
`mobile/fastlane/metadata/android/es-419/changelogs/default.txt` que citen lo
que reportaron los verificadores.

| Día | Versión | Contenido |
|---|---|---|
| 0 | 1.3.1 | Lo que ya está en `main` sin publicar (notas actuales de `default.txt`) + arreglos abiertos de `bug_reports` |
| ~6 | 1.3.2 | Arreglos de lo reportado en semana 1 |
| ~12 | 1.4.0 | Arreglos de semana 2 + un ajuste de UX pedido por verificadores |

Reglas:
- Cada versión se puede construir y subir en ≤1 día (`pnpm build:aab:production` → `eas submit`). Nada de features grandes en la ventana.
- Revisar el **pre-launch report** de Play después de cada subida; cero crashes antes de la siguiente.
- Fuente de arreglos: `bug_reports` (Supabase) + Testing feedback de Play + WhatsApp. Nada de BACKLOG ajeno a lo reportado.

## Guion por semana (para que usen toda la app, no solo la abran)

Se manda al grupo el día 0 y el día 7.

**Semana 1 — arrancar**
1. Completa el onboarding con tus datos reales (o "Probar demo sin cuenta").
2. Registra **3 gastos** con el botón + en días distintos.
3. Importa **un extracto PDF** de tu banco.

**Semana 2 — volver**
1. Activa **recordatorios de pago** (Ajustes → Notificaciones) — esto da una razón para volver sin que yo insista.
2. Revisa **Presupuesto** y **Deudas**: ¿los números tienen sentido?
3. Prueba **"¿Puedo pagarlo?"** con una compra que estés pensando.

Pings al grupo: día 3, 7 (guion 2), 10, 13. Cortos: "¿cómo va? ¿algo raro?".
Día 13: recordar **no salirse** de la prueba.

## Registro de feedback (esto se vuelve la solicitud)

Llevarlo durante la prueba, no reconstruirlo al final.

| Fecha | Verificador | Canal (Play / app / WhatsApp) | Reporte | Versión que lo cerró |
|---|---|---|---|---|
| | | | | |

## Día 15+ — volver a aplicar

- [ ] Opt-in continuo ≥12 confirmado en Play Console.
- [ ] Reescribir `production-access-application.md` **con números**: N verificadores activos, 3 versiones, M reportes cerrados (del registro).
- [ ] Respuesta a *"¿Qué cambió esta vez?"*: nombrar la cadencia de versiones y el guion semanal — es exactamente lo que Google dijo que faltaba.
- [ ] No afirmar "cerré todos los fallos" si queda alguno abierto.

## Qué NO hacer

- No agregar Sentry/analytics ahora: cambia Data Safety y no lo pide la guía.
- No meter features grandes: el objetivo de la ventana es estabilidad + respuesta a feedback.
- No inflar la solicitud: Google contrasta con sus propias métricas.
