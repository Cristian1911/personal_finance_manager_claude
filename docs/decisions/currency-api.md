# Decisión: API de conversión de monedas

**Fecha:** 2026-04-06
**Estado:** Aprobado

## Contexto

Zeta necesita mostrar valores aproximados de conversión de moneda (COP ↔ USD, etc.) para cuentas multi-divisa. No se requiere precisión en tiempo real — basta con la tasa del día.

## Decisión

Usar **[fawazahmed0/exchange-api](https://github.com/fawazahmed0/exchange-api)** como fuente de tasas de cambio.

## Patrón de implementación

- El **servidor** obtiene las tasas una vez al día (cron o revalidación)
- Se almacenan en caché (DB o memoria) para todos los usuarios
- Los usuarios nunca llaman a la API externa directamente
- Si el fetch falla, se mantiene la última tasa conocida

**Endpoint:**
```
https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json
```

Retorna todas las tasas desde USD en un solo JSON. Sin key, sin auth.

## Por qué esta API

| Criterio | fawazahmed0 | Frankfurter | Fixer |
|---|---|---|---|
| API Key | No | No | Sí |
| Rate limits | Sin límite | Sin cuota mensual | 100/mes gratis |
| Monedas | 200+ | 160+ | 170 |
| Actualización fines de semana | Sí | No (ECB no publica) | Sí |
| Formato | JSON estático en CDN | REST API | REST API |

- **Sin API key** → sin secrets que gestionar, deploy más simple
- **JSON estático en CDN** → diseñado exactamente para fetch diario + cacheo
- **Actualiza fines de semana** → Frankfurter usa datos del ECB que no publica sábados/domingos
- **200+ monedas** → cubre COP y cualquier otra que necesitemos

## Alternativa de respaldo

Si fawazahmed0 deja de funcionar: **Frankfurter** (`https://frankfurter.dev/`) — mismo patrón, sin key, pero sin datos de fines de semana.
