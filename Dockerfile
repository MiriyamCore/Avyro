# syntax=docker/dockerfile:1
# Production image for Avyro (web, API, worker, migrate).
# Local development still uses docker-compose.yml (Postgres + Redis only).

FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/accounting/package.json packages/accounting/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/testing/package.json packages/testing/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/validation/package.json packages/validation/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV BETTER_AUTH_SECRET=build-time-placeholder-not-used
ENV API_URL=http://api:3001
ENV API_INTERNAL_URL=http://api:3001
ENV WEB_URL=http://localhost:3000
ENV BETTER_AUTH_URL=http://localhost:3000
RUN pnpm db:generate
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates postgresql-client \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /data/storage /data/backups \
  && chown -R node:node /data
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000 3001
CMD ["node", "apps/api/dist/main.js"]
