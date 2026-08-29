# Contributing to Avyro

Thank you for your interest in Avyro. This project is in **public beta** — we welcome bug reports, documentation improvements, and focused pull requests.

## Getting started

### Prerequisites

- Node.js ≥ 20
- pnpm 9.15 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- Docker (recommended) for PostgreSQL and Redis

### Local setup

```bash
git clone git@github.com:MiriyamCore/Avyro.git
cd Avyro
# Or clone your fork and add upstream to MiriyamCore/Avyro
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Web: http://localhost:3000 · API: http://localhost:3001

Default seed login (local dev only): `owner@demo.local` / `ChangeMeNow1!`

## Before you open a PR

1. **Discuss large changes first** — open an issue for new features, architectural shifts, or compliance rule changes.
2. **Run checks:**
   ```bash
   pnpm typecheck
   pnpm test
   pnpm build
   ```
3. **Keep PRs focused** — one concern per pull request when possible.
4. **Match existing style** — TypeScript, NestJS patterns in the API, Next.js App Router in the web app, Prisma for data access.

## Development principles

These are non-negotiable for tenant and ledger code:

1. **Scope all tenant data** by `organization_id`.
2. **Post journals only** through `AccountingPostingService`.
3. **Never use floating-point** for money — use `Decimal` / `db.Decimal`.
4. **Never hard-code** tax rates or organisation-specific IDs — use effective-dated `tax_codes` configuration.

See [`avyro-SPEC.md`](./avyro-SPEC.md) and [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for deeper context.

## Code style

- Follow patterns in the surrounding file — naming, imports, error handling.
- Prefer minimal, focused diffs over broad refactors.
- Add comments only for non-obvious business logic.
- Do not commit secrets, real TIN/BIN numbers, or production customer data.

## Reporting issues

- **Bugs:** include steps to reproduce, expected vs actual behaviour, and environment (OS, Node version).
- **Security vulnerabilities:** see [SECURITY.md](./SECURITY.md) — do not open public issues for sensitive findings.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
