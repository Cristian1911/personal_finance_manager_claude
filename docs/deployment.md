# Deployment Guide — Zeta on Hostinger VPS

## Architecture Overview

```
GitHub (main branch)
  │
  ├── PR opened/updated → pr-build-images.yml
  │     └── Builds Docker images tagged: webapp-sha-<HEAD_SHA>, parser-sha-<HEAD_SHA>
  │     └── Pushes to GHCR (ghcr.io/cristian1911/personal_finance_manager_claude)
  │
  └── Merge to main → deploy.yml
        ├── 1. Detect what changed (webapp / parser / infra)
        ├── 2. Promote: retag PR image (sha-<X>) → :webapp-latest / :parser-latest
        │      └── Falls back to full build if PR image doesn't exist
        └── 3. Deploy: Hostinger API pulls new images on VPS and restarts containers
```

## How It Works Step by Step

### 1. PR Build (`pr-build-images.yml`)

When you open or push to a PR targeting `main`, if webapp or parser files changed:
- Docker image is built and pushed to GHCR with a SHA tag: `webapp-sha-<PR_HEAD_SHA>`
- This is the **actual production image** — it includes `NEXT_PUBLIC_*` env vars baked in at build time
- Build uses GitHub Actions cache for Docker layers

### 2. Merge Deploy (`deploy.yml`)

When the PR is squash-merged to `main`:

1. **Change detection** — `dorny/paths-filter` checks which areas changed
2. **Find PR SHA** — looks up the merged PR's head SHA via GitHub API
3. **Promote image** — retags `webapp-sha-<HEAD_SHA>` → `webapp-latest` using `docker buildx imagetools create` (no rebuild needed — just a manifest retag)
4. **Fallback build** — if the SHA tag doesn't exist (direct push, workflow_dispatch), does a full Docker build
5. **Deploy to VPS** — uses `hostinger/deploy-on-vps@v2` action which:
   - Connects to the VPS via Hostinger API (not SSH)
   - Writes the docker-compose file and environment variables
   - Runs `docker compose pull && docker compose up -d`

### 3. VPS Setup

- **Host**: `root@<VPS_IP>` (SSH key auth, no password — check team credentials for actual IP)
- **Project dir**: `/docker/personal-finance-manager/`
- **Compose file**: managed by Hostinger deploy action
- **Network**: `nginx-proxy` (external) connects to Nginx Proxy Manager for SSL termination
- **Ports**: webapp on 3000 (internal), exposed via Nginx reverse proxy on 443

### Environment Variables on VPS

The `.env` file at `/docker/personal-finance-manager/.env` is written by the deploy action on each deploy. Key vars:
- `GITHUB_REPO` — used in image reference
- `GHCR_USERNAME` / `GHCR_TOKEN` — for pulling private images
- `NEXT_PUBLIC_*` — runtime vars (but note: NEXT_PUBLIC vars are baked at build time, not read at runtime in standalone mode)
- `SUPABASE_SECRET_KEY` — server-only secret
- `PDF_PARSER_API_KEY` — shared secret between webapp and parser

### Build Metadata

Each image includes `NEXT_PUBLIC_BUILD_SHA` and `NEXT_PUBLIC_BUILD_TIME` baked in at build time. These are visible in the app at **Ajustes** (Settings) → bottom of the page, showing:
- Short commit SHA
- Build timestamp
- Relative time since deploy

## Common Operations

### Check what's deployed
```bash
ssh root@<VPS_IP> "docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.CreatedAt}}'"
```

### Check deployed image
```bash
ssh root@<VPS_IP> "docker exec personal-finance-manager-webapp-1 cat /app/webapp/.next/BUILD_ID"
```

### Force redeploy (same image)
```bash
ssh root@<VPS_IP> "cd /docker/personal-finance-manager && docker compose pull && docker compose up -d"
```

### Force full rebuild + deploy
Trigger from GitHub Actions → "Build and Deploy" → Run workflow → check "Force full rebuild"

### View container logs
```bash
ssh root@<VPS_IP> "docker logs --tail 50 personal-finance-manager-webapp-1"
```

## Gotchas

1. **NEXT_PUBLIC vars are baked at build time** — changing them in `.env` on the VPS does nothing. They must be set as build-args in the Dockerfile during CI.

2. **Image promotion, not rebuild** — on merge, the deploy workflow retags the PR-built image. If the PR CI build failed or was skipped, the deploy falls back to a full build.

3. **Hostinger deploy action** — this is NOT an SSH deploy. It uses the Hostinger API. The `.env` and `docker-compose.yml` are written by the action, not manually managed.

4. **Browser caching** — Next.js serves static assets with long cache headers. Hard refresh (`Cmd+Shift+R`) or incognito may be needed to see changes after deploy.

5. **The deploy only triggers when relevant paths change** — if you only changed `.planning/` or `docs/`, no deploy runs. The path filter covers `webapp/`, `packages/shared/`, `services/pdf_parser/`, and infra files.
