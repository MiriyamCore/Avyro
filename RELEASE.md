# Release notes

## v0.1.0-beta.2 — Portable backups, dark mode, shell polish

**Date:** 2026-09-01

### Highlights

- **Portable backups** — org-scoped `.tar.gz` archives built in Node.js (no `pg_dump` / external tools required for new backups)
- **Restore from upload** — owners upload a backup file in Settings → Backups to restore on any instance
- **Inline backup execution** — backups run in the API by default; set `BACKUP_USE_QUEUE=true` when running the worker for queued jobs
- **Dark mode** — default theme matches [miriyamcore.com/avyro](https://miriyamcore.com/avyro); per-user preference in Settings → Display (dark / light / system)
- **Sign out** — sidebar footer and Settings → Security
- **Landing page** — guests see Sign in only; signed-in users redirect to the app
- **Branding** — updated Avyro mark (transparent PNG)

### Upgrade notes

After pulling, apply the new migration:

```bash
pnpm db:migrate:deploy
```

New env vars (optional): see `.env.example` — `BACKUP_USE_QUEUE`, `BACKUP_SCHEDULER_INTERVAL_MS`.

### Report issues

See [SECURITY.md](./SECURITY.md) for vulnerability disclosure and [CONTRIBUTING.md](./CONTRIBUTING.md) for pull requests.

---

## v0.1.0-beta.1 — Public beta

**Date:** 2026-08-29

First public beta of **Avyro**, the open-source business OS from [Miriyam Core](https://miriyamcore.com).

### Highlights

- Multi-tenant workspace with Better Auth, RBAC, and audit logging
- Double-entry ledger via `AccountingPostingService` with integration tests
- Sales, purchases, banking, FX, payroll, and Bangladesh compliance exports
- Next.js web app (Simple + Accountant modes) and NestJS API
- BullMQ worker for outbound email (SMTP optional)
- Test payment gateway and SSLCommerz sandbox integration

### Self-host quick start

```bash
git clone git@github.com:MiriyamCore/Avyro.git
cd Avyro
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:generate && pnpm db:migrate && pnpm db:seed
pnpm dev
```

Demo login after seed: `owner@demo.local` / `ChangeMeNow1!` (override via `SEED_*` in `.env`).

### Beta caveats

- Not legal or tax advice; no automated NBR filing
- bKash/Nagad adapters are stubs; local filesystem storage by default
- Change `BETTER_AUTH_SECRET` and seed credentials before shared deployments

### Report issues

See [SECURITY.md](./SECURITY.md) for vulnerability disclosure and [CONTRIBUTING.md](./CONTRIBUTING.md) for pull requests.
