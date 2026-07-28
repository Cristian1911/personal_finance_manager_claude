# Crítica de UX/UI del app móvil — 2026-07-28

Observado en el simulador iOS con datos reales, recorriendo ~20 pantallas. Esto **no es una lista de bugs** — eso está en `2026-07-28-mobile-simulator-audit.md`. Aquí todo funciona; el problema es de diseño, y casi nada se arregla sin decisión humana.

Ordenado por cuánto daño hace, no por costo de arreglo.

---

## 1. Controles que no corresponden al dato que piden

**El selector de día es el peor control de la app.** "Día de corte" y "Día de pago" son 31 círculos en un scroll horizontal. Para elegir el 28 hay que arrastrar dos tercios de una lista sin ninguna referencia visual de dónde estás — no hay semana, no hay agrupación, no hay forma de saltar. Y como el control es una lista plana de 1 a 31, no existe el concepto de "último día del mes": un corte el 31 simplemente no ocurre en febrero.

Aparece en crear cuenta, editar cuenta y el formulario de recurrentes — o sea, en los tres momentos donde el usuario configura algo que va a repetirse todos los meses.

Alternativas que valdría probar: una grilla de calendario 7×5 (el usuario ya tiene ese mapa mental), un input numérico simple con validación, o una rueda nativa. Cualquiera de las tres resuelve además el caso "fin de mes" con una opción explícita.

**Otros dos del mismo tipo:**
- El **selector de moneda** es una fila horizontal de 8 opciones donde COP cubre prácticamente todos los casos. Ocupa el mismo peso visual que el nombre de la cuenta.
- El **selector de color** son 8 círculos en rojo, azul, rosa y morado puros — saturados, de una paleta que no es la de Zeta. En una app construida sobre brass y sage, esa fila parece pegada de otra aplicación.

---

## 2. Cuando todo grita, nada se oye

**Presupuestos** es el caso extremo: nueve filas, todas con la barra al 100% en rojo, y porcentajes de 2116%, 681%, 365%, 308%, 200%. Cuando cada línea está sobre el límite, el color rojo deja de informar y los números dejan de tener escala — 2116% no se lee como una cantidad, se lee como "roto".

Lo que falta no es más información sino **jerarquía**: colapsar o agrupar lo que está bien, dejar arriba las dos o tres categorías donde el exceso realmente importa (por monto absoluto, no por porcentaje — "Mascotas 2116%" son $3.1M, "Uber 365%" son $219k, y la pantalla los presenta con el mismo peso).

Mismo patrón, menos grave, en **Deudas**: cuatro paneles apilados, cada uno con su eyebrow, todos del mismo tamaño y peso. No hay una respuesta principal, hay cuatro respuestas simultáneas.

---

## 3. Inicio tiene cuatro metáforas de organización a la vez

En una sola pantalla conviven: el hero, una sección "HERRAMIENTAS" con 3 tarjetas, una sección "WIDGETS" con 2 tarjetas, y un botón "ORGANIZAR".

La distinción entre *herramienta* y *widget* no significa nada para quien usa la app — visualmente son la misma tarjeta, con el mismo borde y el mismo eyebrow. Son dos nombres internos que se filtraron a la interfaz. Y "ORGANIZAR" al final sugiere un tercer modo sin explicar sobre qué opera.

---

## 4. El contenido principal está debajo del fold

En **Movimientos**, para llegar al primer movimiento hay que pasar por: selector de mes → "LECTURA" (resumen del mes) → "HERRAMIENTAS" (2 tarjetas) → fila de búsqueda y filtros. Cuatro bloques antes del contenido que da nombre a la pantalla.

Cada bloque por separado es defendible. Juntos empujan la lista fuera de la primera pantalla, que es exactamente lo que el usuario vino a ver.

---

## 5. La misma pregunta se responde en tres idiomas

"¿Voy bien?" es la pregunta central de la app, y cada pantalla la contesta distinto:

- **Inicio** usa un chip de veredicto: "VAS BIEN" / "CERCA DEL LÍMITE" / "TE PASASTE".
- **Presupuestos** usa otro chip: "SOBRE LÍMITE".
- **Plan** no usa ninguno: muestra −$9.336.654 en rojo y deja que el usuario interprete.

Plan es el que más lo necesita y el único que no lo tiene.

**Y en Inicio hay dos porcentajes con semántica opuesta, sin distinción visual:** "RITMO 90%" (avance del mes, es *tiempo*) y "98% del período" (presupuesto gastado, es *dinero*). Están a pocos centímetros, ambos en la misma tipografía. Que uno vaya en 90 y el otro en 98 es coincidencia; el usuario los va a leer como la misma métrica.

Dos incoherencias menores del mismo tipo: Presupuestos anuncia "50·30·20" pero solo muestra dos de los tres cubos; y el hero de Inicio está calculado sobre la cuenta principal sin decirlo, así que sus totales no cuadran con los de Movimientos, que son globales.

---

## 6. Tres gramáticas distintas para la misma fila

| Pantalla | Qué pasa al tocar una fila |
|---|---|
| Movimientos | expande acciones en línea |
| Cuentas | navega a un detalle |
| Presupuestos, Deudas | expande un acordeón |

Las tres filas se ven casi igual. El usuario no puede predecir si tocar va a navegar, expandir o desplegar acciones — y en móvil eso se paga con toques a ciegas.

---

## 7. Los diálogos nativos rompen el lenguaje visual

Varias acciones abren `Alert` nativo de iOS: el menú "Más" del detalle de cuenta (Editar / Eliminar), el "Próximamente" de captura rápida, y las confirmaciones destructivas.

En una app de tema oscuro con identidad tan marcada, el cuadro blanco de iOS es un corte visual fuerte — y peor: en el detalle de cuenta, un **menú de navegación** está implementado como alerta, que es un patrón para decisiones, no para navegar.

---

## 8. Formularios que piden lo raro antes que lo común

**Nueva cuenta** dedica media pantalla a siete tarjetas grandes de tipo de cuenta antes de preguntar el nombre. La mayoría de la gente crea una o dos cuentas, casi siempre corriente o tarjeta. Ese control merece ser compacto y estar después de lo que el usuario sí tiene claro.

En el mismo formulario, "Tasa de interés mensual (%)" y "Día de corte" tienen el mismo peso visual que "Nombre" — campos opcionales de configuración fina compitiendo con el dato esencial.

---

## 9. Vacíos que no invitan a nada

- La mitad inferior de **Plan** queda vacía después de tres chips.
- "Sin periodo activo" es un estado terminal: informa que no hay periodo pero no ofrece crearlo.
- Hay ~20 empty states escritos a mano, casi ninguno con una acción (ya está en `BACKLOG.md` como deuda de componente).

---

## Por dónde empezaría

1. **El selector de día** — es acotado, se repite en tres pantallas, y hoy es el control que más fricción genera por toque.
2. **Jerarquía en Presupuestos** — es la pantalla donde el diseño actual falla más rápido con datos reales.
3. **Unificar el veredicto** — ya existe la primitiva en la webapp (`Verdict`, 4 estados); móvil define otra cosa con el mismo nombre. Es la pieza que haría que las tres pantallas respondan igual.
4. **Decidir una gramática de fila** y aplicarla — barato en decisión, caro en refactor, pero es lo que más afecta la sensación de que la app "se comporta".

Los puntos 3 y 4 se apoyan en la deuda de primitivas ya registrada en `BACKLOG.md` (`EntityRow`, `Field`, `Verdict` sin espejo móvil): resolver esa deuda y resolver esta incoherencia de UX son, en buena medida, el mismo trabajo.
