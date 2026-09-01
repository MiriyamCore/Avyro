# Deployment

## Local

`docker-compose.yml` starts **Postgres + Redis only**. Apps still run with `pnpm dev`. That file is **not** a production deploy.

```bash
docker compose up -d
pnpm db:generate && pnpm db:migrate && pnpm db:seed
pnpm dev
```

## Production

Production uses **Docker Compose** to run Postgres, Redis, API, web, worker, and nginx (reverse proxy).

| File | Role |
|------|------|
| `docker-compose.yml` | Local Postgres + Redis only — do not use on the server |
| `docker-compose.prod.yml` | Full production stack |
| `Dockerfile` | Image for API, web, worker, migrate, seed |
| `.env.production.example` | Server env template |
| `infra/scripts/deploy.sh` | Build, migrate, start |
| `infra/nginx/` | HTTP/HTTPS reverse proxy |

### 1. Copy the project to the server

On your laptop:

```bash
rsync -avz --exclude node_modules --exclude .next --exclude dist --exclude .git \
  --exclude .env --exclude .data \
  ./ user@YOUR_SERVER:/opt/avyro/
```

Or clone on the server:

```bash
sudo mkdir -p /opt/avyro
sudo chown "$USER":"$USER" /opt/avyro
git clone git@github.com:MiriyamCore/Avyro.git /opt/avyro
cd /opt/avyro
```

### 2. Install Docker on the server

Ubuntu/Debian:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
# log out and back in so the docker group applies
docker compose version
```

### 3. Create production `.env`

```bash
cd /opt/avyro
cp .env.production.example .env
nano .env
```

Set at least:

1. `POSTGRES_PASSWORD` — long random string; use the **same** value inside `DATABASE_URL`
2. `BETTER_AUTH_SECRET` — `openssl rand -hex 32`
3. `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` / `SEED_OWNER_NAME` — your login (first boot only)
4. `WEB_URL`, `BETTER_AUTH_URL`, `API_URL` — must match the URL you type in the browser (including `http` vs `https`)
5. `NGINX_HOST` — leave as `_` until you have a domain; see HTTPS below

If these URLs say `https://…` but you open `http://SERVER_IP`, login cookies will not stick.

`DATABASE_URL` and `REDIS_URL` must use Docker service hosts `postgres` and `redis`, not `localhost`. Avoid `$`, `"`, and `#` in `POSTGRES_PASSWORD` (they break Compose interpolation); use `openssl rand -hex 24` instead.

### 4. First boot

```bash
chmod +x infra/scripts/deploy.sh
./infra/scripts/deploy.sh --seed
```

This builds the image, starts Postgres and Redis, applies Prisma migrations, creates the owner organisation, then starts API, worker, web, and nginx.

Check:

```bash
curl -sS http://127.0.0.1/api/v1/health
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f --tail=80
```

Open `http://YOUR_SERVER_IP/` and sign in with `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD`. Change that password after login.

The first image build usually takes 5–15 minutes.

**Do not run `--seed` again** on this database. Later deploys:

```bash
./infra/scripts/deploy.sh
```

### 5. Domain and HTTPS

Point a DNS **A record** at the server (for example `avyro.example.com`).

In `.env`:

```bash
NGINX_HOST=avyro.example.com
ACME_EMAIL=you@example.com
WEB_URL=https://avyro.example.com
BETTER_AUTH_URL=https://avyro.example.com
API_URL=https://avyro.example.com
```

Ports **80** and **443** must be open. Then:

```bash
./infra/scripts/deploy.sh --https
```

nginx serves HTTP until a certificate exists. Certbot then issues a Let's Encrypt cert and nginx reloads with TLS. Until DNS is ready, keep `NGINX_HOST=_` and use `http://YOUR_SERVER_IP/`.

### 6. After each code update

```bash
cd /opt/avyro
git pull          # or rsync from your laptop
./infra/scripts/deploy.sh
```

Migrations run automatically. Uploads, Postgres, and Redis live in Docker volumes and survive rebuilds.

### Useful commands

```bash
# logs
docker compose -f docker-compose.prod.yml logs -f nginx api web worker

# stop
./infra/scripts/deploy.sh --down

# Built-in org backups (recommended)
# Settings → Backups in the web UI, or schedule via owner settings.
# Archives are portable .tar.gz files under BACKUP_ROOT or S3 when configured.

# Manual PostgreSQL dump (optional — full database, all tenants)
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U accounting avyro > avyro-$(date +%Y%m%d).sql
```

### 7. Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Deploy script refuses to run | `.env` still has example secrets, or `DATABASE_URL` uses `localhost` instead of `postgres` |
| `Bind for 0.0.0.0:80 failed` | Another nginx/apache is already on port 80 — stop it or change the published ports on the nginx service |
| `Bind for 127.0.0.1:5432 failed` | Postgres already running on the host — stop it or remove the ports mapping in `docker-compose.prod.yml` |
| Login succeeds then immediately logs out | `WEB_URL` / `BETTER_AUTH_URL` do not match the browser URL (http vs https, IP vs domain) |
| Certificate errors / `--https` fails | DNS A-record does not point at this server yet — keep `NGINX_HOST=_` until it does |
| Health check never passes | `docker compose -f docker-compose.prod.yml logs api` — usually bad `DATABASE_URL` or migrate failed |

### What not to do

- Do not run `docker compose up` (the local file) on the server — it only starts Postgres/Redis with the **dev** password and does not start the apps.
- Do not run `pnpm db:seed` against production except the first `--seed` deploy.
- Do not publish Postgres or Redis to the public internet (`docker-compose.prod.yml` binds Postgres to `127.0.0.1` only).
- Do not commit `.env`.
