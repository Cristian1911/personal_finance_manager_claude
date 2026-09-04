# Plan de infraestructura — Beta por PR, panel de administración y decisión sobre la BD
**Escrito:** 2026-09-04 | **Estado:** Pendiente (ejecutar desde el PC, no desde el móvil)
**Alcance:** VPS Hostinger, nginx/certbot, GitHub Actions, DNS, Supabase

---

## Contexto

Hoy el flujo es: PR → `pr-build-images.yml` construye `webapp-sha-<sha>` (con la
etiqueta `build-image` o al pasar a *ready for review*) → merge a `main` →
`deploy.yml` promueve esa imagen a `webapp-latest` y hace SSH al VPS para
`docker compose down / pull / up`. Solo hay un entorno (producción) y un solo
proyecto Supabase (`tgkhaxipfgskxydotdtu`), sin Docker local.

Tres objetivos, en orden de valor:

1. **Beta por PR** — probar cambios en `beta.<dominio>` antes de mezclar.
2. **Panel de administración accesible desde el móvil** — contenedores, proxy,
   certificados, DNS, uptime.
3. **Decisión sobre la base de datos** — se queda en Supabase (ver §3).

Decisiones ya tomadas en la conversación del 2026-09-04:

- La BD **no** se self-hostea. Supabase se queda.
- Beta fase 1 usa la **misma** BD de producción; el aislamiento por PR (Supabase
  Branching) es fase 2 y opcional.
- El panel de administración va detrás de Tailscale, nunca expuesto público.

---

## 0 · Prerrequisitos (verificar antes de empezar)

- [ ] RAM libre en el VPS: `free -h` y `docker stats --no-stream`. Beta suma un
      segundo Next standalone + segundo parser (≈500 MB–1 GB). Coolify, si se
      elige, pide ≈2 GB adicionales.
- [ ] Dónde vive la zona DNS hoy (Hostinger). Decidir si se mueve a Cloudflare
      (recomendado: app móvil, API, DNS-challenge para wildcard).
- [ ] Confirmar el subdominio: `beta.pfm.sanson1911.cloud` (propuesta).
- [ ] Tener a mano los secrets del repo que la beta reutiliza:
      `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
      `SUPABASE_SECRET_KEY`, `PDF_PARSER_API_KEY`, `VPS_HOST`, `VPS_SSH_KEY`,
      `GHCR_PAT_READ`.

---

## 1 · Beta por PR — Fase 1 (mismo VPS, misma BD)

### 1.1 DNS y certificado
- [ ] Registro `A` para `beta.<dominio>` → IP del VPS.
- [ ] Certificado. Dos opciones:
  - **Expandir el cert actual:** `certbot certonly --webroot -w /var/www/certbot
    -d pfm.<dominio> -d beta.<dominio> --expand`. Simple, pero hay que repetirlo
    por cada subdominio nuevo.
  - **Wildcard `*.<dominio>` por DNS-challenge** (requiere Cloudflare u otro
    proveedor con plugin certbot). Recomendado si se van a sumar más paneles.

### 1.2 nginx
Archivo: `infra/nginx/default.conf.template`
- [ ] Añadir `upstream webapp_beta { server webapp-beta:3000; }`.
- [ ] Añadir un segundo bloque `server { listen 443 ssl; server_name beta.<dominio>; ... }`
      copiando el de producción, con `proxy_pass http://webapp_beta` y los mismos
      timeouts (180 s) y `client_max_body_size 12M`.
- [ ] En ese bloque: `add_header X-Robots-Tag "noindex, nofollow" always;` para
      que beta no se indexe.
- [ ] El bloque 80 → 301 ya usa `server_name _`, cubre beta sin cambios.
- [ ] Si se usó wildcard, `envsubst` en `docker-entrypoint.sh` sigue igual
      (`$DOMAIN` apunta al dir del cert wildcard).

### 1.3 Compose de beta
Archivo nuevo: `docker-compose.beta.yml` (en el VPS vive en
`/docker/personal-finance-manager-beta/docker-compose.yml`).
- [ ] Servicios `webapp-beta` y `pdf-parser-beta`, copiados de
      `docker-compose.prod.yml`, con:
  - `image: ghcr.io/${GITHUB_REPO}:webapp-beta` / `:parser-beta`
  - **sin** `ports:` (solo la red `nginx-proxy`; nginx llega por nombre de servicio)
  - `PDF_PARSER_URL=http://pdf-parser-beta:8000`
  - `NEXT_PUBLIC_APP_URL=https://beta.<dominio>`
  - `APP_URL=https://beta.<dominio>` (lo lee `derivePublicBaseUrl` en runtime)
- [ ] `.env` separado en ese directorio (mismo Supabase; mismo `PDF_PARSER_API_KEY`
      está bien porque el parser es interno).

### 1.4 Código de la webapp
- [ ] `webapp/src/lib/utils/public-base-url.ts`: añadir `beta.<dominio>` a
      `STATIC_ALLOWED_HOSTS`. Sin esto, los correos de recuperación/confirmación
      generados desde beta apuntan a producción.
- [ ] Banner "BETA" en el shell (móvil y desktop) cuando
      `NEXT_PUBLIC_APP_URL` empiece por `https://beta.`. Mostrar el SHA corto
      que ya expone `NEXT_PUBLIC_BUILD_SHA` (ver `components/settings/build-info.tsx`).
      Tokens: `bg-z-brass/15 text-z-brass`, sin colores hardcodeados.
- [ ] `middleware.ts` / CSP: nada que cambiar (mismo origen). HSTS ya lleva
      `includeSubDomains`.

### 1.5 Supabase Auth
- [ ] Dashboard → Authentication → URL Configuration → *Redirect URLs*: añadir
      `https://beta.<dominio>/auth/callback` y
      `https://beta.<dominio>/auth/callback?next=/reset-password`.
- [ ] *Site URL* se queda en producción.

### 1.6 Workflow `deploy-beta.yml`
Disparadores:
- `pull_request` con `types: [labeled, synchronize]` y filtro
  `contains(github.event.pull_request.labels.*.name, 'deploy-beta')`.
- `pull_request` con `types: [closed]` → job de *teardown* (ver abajo).
- `workflow_dispatch` con input `ref` (rama o SHA) para desplegar `main` u otra
  cosa a mano.

Jobs:
1. **build** — `docker/build-push-action` con los mismos build-args que
   `pr-build-images.yml` **pero** `NEXT_PUBLIC_APP_URL=https://beta.<dominio>`,
   tags `webapp-beta` y `webapp-beta-sha-<sha>`; idem parser (`parser-beta`).
   No se puede reutilizar `webapp-sha-<sha>` de producción porque
   `NEXT_PUBLIC_APP_URL` va inlined en el bundle.
2. **deploy** — copiar `docker-compose.beta.yml` por `scp` y ejecutar en el VPS
   `docker compose -p pfm-beta pull && docker compose -p pfm-beta up -d`
   (sin `down`: con `pull_policy: always` y un `up -d` basta y evita un hueco).
   Reusar el helper `retry` y el patrón de script en fichero de `deploy.yml`.
3. **comment** — `gh pr comment` con la URL, el SHA y la hora. Editar el mismo
   comentario en despliegues sucesivos (buscar por un marcador HTML).
4. **teardown** (en `closed`) — si el PR cerrado es el que ocupa beta
   (comparar SHA anotado en un `docker label` o en el comentario), redesplegar
   `main` en beta o `docker compose -p pfm-beta down`.

Reglas:
- `concurrency: { group: beta-env, cancel-in-progress: false }` — un solo PR
  ocupa beta; el siguiente espera.
- Solo PRs del propio repo (`github.event.pull_request.head.repo.fork == false`),
  igual que hoy.
- `permissions: { contents: read, packages: write, pull-requests: write }`.

### 1.7 Documentación
- [ ] Sección "Entorno beta" en `docs/deployment.md`: cómo etiquetar el PR, qué
      se comparte con producción (BD, Auth, parser key), qué no (webhook de
      Resend: el ingest de correo solo llega a producción).
- [ ] Añadir `deploy-beta.yml` a los `paths` de `deploy.yml` y
      `pr-build-images.yml` para que un cambio en él dispare verificación.

### 1.8 Verificación
- [ ] Etiquetar un PR trivial con `deploy-beta`, abrir `https://beta.<dominio>`
      desde el móvil, iniciar sesión, crear una transacción, verificar que la
      recuperación de contraseña enlaza a beta.
- [ ] Cerrar el PR y comprobar el teardown.
- [ ] `docker stats` con ambos entornos arriba.

---

## 2 · Beta — Fase 2 (opcional): BD aislada por PR con Supabase Branching

Solo tiene sentido cuando haya PRs con migraciones que se quieran probar sin
tocar producción.

- Requiere plan Pro + coste por rama activa. Evaluar precio actual antes.
- Instalar la integración de GitHub de Supabase; cada PR con cambios en
  `supabase/migrations/` crea una *preview branch* con las migraciones aplicadas.
- `deploy-beta.yml` toma `NEXT_PUBLIC_SUPABASE_URL` / publishable key / secret
  de la rama (la integración las expone como outputs o vía API) y las inyecta
  en el build y en el `.env` de beta.
- Pendiente a investigar: cómo se propaga la **clave de cifrado** de las tablas
  `_enc` a la rama (Vault/secretos por proyecto). Sin eso, las vistas cifradas
  devuelven NULL en la rama. Consultar `supabase-migrator` antes de arrancar.
- Datos: la rama nace vacía; usar el seed/modo demo existente para tener
  datos de prueba.

---

## 3 · Base de datos — decisión: se queda en Supabase

Razones (para no volver a abrir el debate):

- La app no usa "solo Postgres": Auth, PostgREST, RLS, cifrado por sobre
  (`zeta_decrypt_as`), `createCachedClient(accessToken)`, y el móvil sincroniza
  directo contra Supabase. Self-hostear implica el stack completo (~8
  contenedores, ≥4 GB RAM).
- Backups, PITR, parches y upgrades pasarían a ser responsabilidad propia, en el
  mismo VPS que ya hospeda la app: una brecha expone todo a la vez.
- Se perdería Branching (fase 2 de beta).
- Coste: Pro son 25 USD/mes con backups diarios; la RAM extra del VPS más el
  tiempo propio no salen más baratos.

Acción que sí vale la pena:
- [ ] Backup independiente: cron en el VPS con `pg_dump` (rol de solo lectura,
      conexión directa `db.<ref>.supabase.co:5432`) → cifrar con `age` → subir a
      un bucket fuera del VPS (Backblaze B2 / Cloudflare R2). Retención 30 días.
      Probar una restauración una vez.

---

## 4 · Panel de administración desde el móvil

Dos rutas; elegir una.

### Ruta A — Conservar el deploy actual (mínima)
- [ ] **Tailscale** en el VPS y en el móvil. Todos los paneles escuchan solo en
      la IP de Tailscale (`100.x.y.z`) o en `127.0.0.1` con `ports:` bindeados a
      esa IP. Ningún panel público.
- [ ] **Portainer CE** — contenedores, logs, restart, compose.
- [ ] **Nginx Proxy Manager** — reemplaza `infra/nginx` + certbot: hosts,
      certificados Let's Encrypt (incluido wildcard por DNS-challenge con
      Cloudflare), redirecciones. Migrar los dos bloques (prod y beta) y los
      headers de seguridad (CSP, HSTS, Permissions-Policy) a "Custom Nginx
      Configuration" del host. Eliminar `infra/nginx/` del repo cuando esté
      probado.
- [ ] **Uptime Kuma** — monitores HTTP de prod y beta, notificación push al
      móvil (Telegram o ntfy).
- [ ] **Dozzle** — logs en vivo (opcional).
- [ ] Un `docker-compose.admin.yml` con los cuatro, en su propio directorio del
      VPS, documentado en `docs/deployment.md`.

### Ruta B — PaaS self-hosted (reemplaza el deploy)
- **Coolify** (o **Dokploy**, más liviano y más fiel a Compose).
- Gestiona apps por Compose, dominios, proxy Traefik, SSL automático, deploy
  desde GitHub y **preview deployments por PR** (resuelve §1 casi entero).
- Coste: ≈2 GB RAM; sustituye `deploy.yml`, `infra/nginx`, certbot y el
  workflow de beta a mano. Migración en un fin de semana con el PC delante.
- Si se elige B, hacer primero §4-A solo con Tailscale y Uptime Kuma, y dejar
  §1 sin implementar (Coolify lo cubre).

### DNS
- [ ] No self-hostear un servidor DNS. Mover la zona a **Cloudflare** (gratis):
      app móvil, API para crear subdominios desde workflows, DNS-challenge para
      wildcard, y opcionalmente Cloudflare Access como alternativa a Tailscale.
- [ ] Al mover la zona: modo "DNS only" (nube gris) para `pfm.` y `beta.` al
      principio, para no meter el proxy de Cloudflare delante de nginx sin
      probarlo (afecta `X-Forwarded-For`, tamaño de subida y los timeouts de 180 s).

---

## Orden sugerido de ejecución

1. §0 prerrequisitos (30 min).
2. §4 Tailscale + Uptime Kuma (1 h). Da visibilidad antes de tocar nada más.
3. §3 backup independiente (1 h).
4. Decidir Ruta A o B.
   - **A:** §1 completo (medio día) y luego Portainer + NPM (medio día).
   - **B:** Coolify/Dokploy (1 día) y usar sus previews como beta.
5. §2 solo cuando aparezca el primer PR con migración que dé miedo mezclar.

## Fuera de alcance

- Multi-VPS, alta disponibilidad, Kubernetes.
- Ingest de correo en beta (el webhook de Resend seguirá apuntando a producción).
