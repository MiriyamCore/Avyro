#!/usr/bin/env bash
# Production deploy for Avyro on a Docker host.
# Usage:
#   ./infra/scripts/deploy.sh           # build, migrate, start
#   ./infra/scripts/deploy.sh --seed    # first time only — creates owner + org
#   ./infra/scripts/deploy.sh --https   # issue Let's Encrypt cert and enable TLS
#   ./infra/scripts/deploy.sh --down    # stop the stack

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

COMPOSE=(docker compose -f docker-compose.prod.yml)
SEED=0
DOWN=0
HTTPS=0

for arg in "$@"; do
  case "$arg" in
    --seed) SEED=1 ;;
    --https) HTTPS=1 ;;
    --down) DOWN=1 ;;
    -h|--help)
      sed -n '2,9p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg"
      echo "Usage: $0 [--seed] [--https] [--down]"
      exit 1
      ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed or not on PATH."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required (docker compose)."
  exit 1
fi

if [[ "$DOWN" -eq 1 ]]; then
  "${COMPOSE[@]}" down
  echo "Stack stopped."
  exit 0
fi

if [[ ! -f .env ]]; then
  echo "Missing .env in $ROOT"
  echo "Copy the production template and fill in secrets:"
  echo "  cp .env.production.example .env"
  echo "  nano .env"
  exit 1
fi

fail=0

if grep -Eq '^BETTER_AUTH_SECRET=.*(dev-only-change-me|change-me|changeme)' .env; then
  echo "Refusing to deploy: BETTER_AUTH_SECRET is still an example value."
  fail=1
fi

if grep -Eq '^DATABASE_URL=.*(localhost|127\.0\.0\.1)' .env; then
  echo "Refusing to deploy: DATABASE_URL must use host 'postgres' inside Docker, not localhost."
  fail=1
fi

if grep -Eq '^REDIS_URL=.*(localhost|127\.0\.0\.1)' .env; then
  echo "Refusing to deploy: REDIS_URL must use host 'redis' inside Docker, not localhost."
  fail=1
fi

if grep -Eq '^POSTGRES_PASSWORD=(accounting)?[[:space:]]*$' .env; then
  echo "Refusing to deploy: set a strong POSTGRES_PASSWORD (not the local-dev default)."
  fail=1
fi

if grep -Eq '^SEED_OWNER_PASSWORD=(ChangeMeNow1!)?[[:space:]]*$' .env && [[ "$SEED" -eq 1 ]]; then
  echo "Refusing to seed: set SEED_OWNER_PASSWORD to a strong unique password."
  fail=1
fi

if [[ "$HTTPS" -eq 1 ]]; then
  nginx_host="$(grep -E '^NGINX_HOST=' .env | tail -n1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
  acme_email="$(grep -E '^ACME_EMAIL=' .env | tail -n1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
  if [[ -z "$nginx_host" || "$nginx_host" == "_" ]]; then
    echo "Refusing HTTPS: set NGINX_HOST to your domain (for example avyro.example.com)."
    fail=1
  fi
  if [[ -z "$acme_email" || "$acme_email" == "admin@example.com" ]]; then
    echo "Refusing HTTPS: set ACME_EMAIL to a real address for Let's Encrypt."
    fail=1
  fi
fi

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

echo "Building images…"
"${COMPOSE[@]}" build

echo "Starting Postgres, Redis, and running migrations…"
if [[ "$SEED" -eq 1 ]]; then
  "${COMPOSE[@]}" --profile seed up -d --remove-orphans
else
  "${COMPOSE[@]}" up -d --remove-orphans
fi

echo
"${COMPOSE[@]}" ps
echo
echo "Deploy finished."
echo "  Health (on the server):  curl -sS http://127.0.0.1/api/v1/health"
echo "  Logs:                    docker compose -f docker-compose.prod.yml logs -f --tail=100"

if [[ "$HTTPS" -eq 1 ]]; then
  nginx_host="$(grep -E '^NGINX_HOST=' .env | tail -n1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
  acme_email="$(grep -E '^ACME_EMAIL=' .env | tail -n1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
  echo "Requesting Let's Encrypt certificate for ${nginx_host}…"
  "${COMPOSE[@]}" run --rm --entrypoint certbot certbot certonly \
    --webroot -w /var/www/certbot \
    --email "$acme_email" --agree-tos --no-eff-email \
    -d "$nginx_host"
  "${COMPOSE[@]}" restart nginx
  echo "  HTTPS:                   https://${nginx_host}"
  echo "  Set WEB_URL, BETTER_AUTH_URL, and API_URL to https://${nginx_host} then re-run ./infra/scripts/deploy.sh"
fi

if [[ "$SEED" -eq 1 ]]; then
  echo "  First login:             use SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD from .env"
  echo "  Then change that password in the app. Do not run --seed again on this database."
fi
