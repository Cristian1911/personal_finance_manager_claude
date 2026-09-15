# Play Console — Solicitud de acceso a producción

Textos para pegar. **Cada campo del formulario tope 300 caracteres** — el conteo
va al lado de cada bloque.

Lo que ya tenías puesto en "Acerca de tu app" (público objetivo y valor) y en
"¿Cómo reclutaste usuarios?" está bien: concreto, dentro del límite y cierto.
No lo toques. Abajo están solo los que conviene reemplazar y el que falta.

---

## Describe el nivel de participación de los verificadores

El tuyo (141) responde cuánto usaron, pero la pregunta es si usaron **todas** las
funciones y si ese uso se parece al de un usuario real. Esto responde las dos:

```
Los verificadores la usaron con sus propias finanzas: importaron extractos, registraron gastos y revisaron presupuesto y deudas. Cerca de la mitad la abrió de forma sostenida las dos semanas; el resto, de forma esporádica. El uso coincidió con el de un usuario real.
```
_266/300._

> Deja el "cerca de la mitad" solo si es cierto. Decirlo tú mismo es mejor que
> exagerar y que Google lo contraste con sus propias métricas de la prueba.

---

## Resumen de los comentarios + método para recopilarlos

El tuyo (206) cuenta el canal de WhatsApp pero se deja por fuera el reporte de
errores dentro de la app, que es el que más peso tiene: es infraestructura que
construiste para esto. Además tiene tres typos ("algun", "contraseñá",
"escribian").

```
Método: me escribían directamente y enviaban reportes desde el botón de ayuda dentro de la app, con captura adjunta. Reportaron fallas al recuperar la contraseña, al entrar con Google y funciones que no se comportaban como esperaban. Todo quedó registrado y corregido.
```
_268/300._

---

## ¿Qué cambios hiciste según lo aprendido?

El tuyo (295) es correcto pero genérico — "mejoramos", "optimizamos". Los
revisores premian lo específico y verificable:

```
Corregí el inicio de sesión con Google, agregué seis formatos de alerta bancaria que no se importaban y eliminé movimientos duplicados. Arreglé que un pago hecho de noche quedara con la fecha del día siguiente y que una cuota mensual se generara dos veces.
```
_256/300._

---

## ¿Cómo decidiste que está lista para producción?

```
Los verificadores completaron los flujos principales con sus datos reales sin errores bloqueantes. Cerré los fallos que reportaron y los verifiqué en dispositivo. Dejé un canal de reporte dentro de la app y los datos van cifrados por usuario. La 1.3.0 es estable a diario.
```
_272/300._

---

## Pruebas adicionales — ¿Qué cambió en lo que hiciste esta vez?

Este es el único vacío, y el que decide la solicitud: aparece porque hay un
intento previo. Google quiere saber qué hiciste **distinto**, no qué repetiste.

Solo tú sabes cuál de estas dos es verdad. Elige una, no mezcles.

**Si esta vez dirigiste la prueba (les diste un guion):**
```
Esta vez le di a cada verificador un guion concreto: importar un extracto, registrar un gasto y revisar el presupuesto del mes. Eso destapó fallas que antes nadie alcanzaba. Corregí cada reporte y la app pasó de la versión 1.2.0 a la 1.3.0 antes de volver a aplicar.
```
_266/300._

**Si la diferencia fue la profundidad de uso:**
```
La prueba anterior fue de instalación y poco uso. Esta vez los verificadores usaron la app con su propia plata durante las dos semanas, reportaron desde el botón de ayuda y corregí cada falla. La app pasó de 1.2.0 a 1.3.0 con esos arreglos.
```
_240/300._

---

## Antes de enviar

- [ ] Que el build en producción sea 1.3.0 (versionCode 15), no el 13.
- [ ] Que sea cierto que cerraste todos los fallos reportados — dos respuestas
      lo afirman. Si queda alguno abierto, cambia a "los bloqueantes están
      cerrados".
- [ ] Política de privacidad: `https://pfm.sanson1911.cloud/privacy`.
