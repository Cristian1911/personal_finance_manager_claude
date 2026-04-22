# Capturas para Play Store

Play Store exige **mínimo 2, ideal 4–8** capturas de teléfono.
Dimensiones requeridas: entre **320 px y 3840 px**, ratio entre **16:9 y 9:16**.
Recomendado: **1080×2400** (phone moderno).

## Pantallas sugeridas a capturar

1. **Inicio** — hero con salud financiera
2. **Importar extracto** — wizard paso 2 (Review con cuentas)
3. **Presupuesto** — treemap 50/30/20
4. **Transacciones** — lista + filtros
5. **Plan / Deudas** — projección avalancha
6. **Detalle de destinatario** — tarjeta personificada
7. **¿Puedo pagar?** — simulador de decisión de compra
8. **Ajustes** — biometría + exportar datos

## Opción A — iOS simulator (lo que tienes ahora)

iPhone 17 Pro captura a 1206×2622. Play Store las acepta tras recorte.

```bash
# tener la app abierta y logueada en la pantalla deseada
xcrun simctl io booted screenshot ~/Desktop/zeta-01-inicio.png

# capturar todas con nombres secuenciales (abre la pantalla y pulsa Enter)
for i in 1 2 3 4 5 6 7 8; do
  read -p "Abre la pantalla #$i y presiona Enter..."
  xcrun simctl io booted screenshot ~/Desktop/zeta-0$i.png
done
```

Después recorta el status bar (opcional) y redimensiona a 1080×2400:

```bash
for f in ~/Desktop/zeta-*.png; do
  sips -z 2400 1080 "$f" --out "${f%.png}-playstore.png"
done
```

## Opción B — Android emulator (recomendado antes de publicar)

1. Instalar Android Studio + crear AVD (Pixel 7, API 34)
2. `emulator -avd Pixel_7_API_34`
3. `cd mobile && pnpm android` (build + install)
4. Capturar con `adb`:

```bash
adb exec-out screencap -p > ~/Desktop/zeta-01.png
```

## Opción C — mockups rápidos

Si no quieres capturar manual, existen herramientas:
- [appmockup.com](https://app-mockup.com/) — drag-drop screenshots en marco de
  dispositivo.
- [previewed.app](https://previewed.app/) — templates con fondo degradado.

No necesarios, Play Store acepta screenshots crudas.

## Subirlas a Play Console

Play Console → **Crecimiento** → **Presencia en Store** → **Configuración
principal de la ficha** → **Gráficos** → **Capturas de pantalla de teléfono**.

Mínimo 2, arrastra-suelta hasta 8.
