# Avyro

**The open-source operating system for business.**

Avyro is an open-source business platform that brings accounting, invoicing, expenses, banking, payroll, compliance, projects, and everyday operations into one connected system. Built for small businesses that want simplicity without sacrificing proper financial foundations.

Invoice customers, record expenses, reconcile the bank, run payroll, and stay Mushak-ready. Avyro pairs a **Wave-inspired simple mode** with a **structured double-entry ledger** underneath. It works globally (multi-currency, configurable fiscal year) and ships **first-class Bangladesh compliance** — BDT, Jul–Jun fiscal year, e-TIN/BIN, VAT/TDS/VDS registers.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9.15-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![NestJS](https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org/)

---

## Who it's for

| Audience | What you get |
|----------|--------------|
| **Small business owners** | Simple UI — customers, invoices, expenses, cash snapshot without learning debits and credits |
| **Accountants & bookkeepers** | Accountant mode — chart of accounts, journals, trial balance, month-end checklist |
| **Bangladesh businesses** | Mushak-oriented registers, TDS/VDS tracking, VAT worksheets, e-return evidence exports |
| **Developers & operators** | Self-hostable monorepo — NestJS API, Next.js web, PostgreSQL, Redis worker |

---

## Beta status

Avyro is in **public beta**. The core ledger, sales/purchases workflows, banking, payroll, multi-currency, payment gateways (test + SSLCommerz sandbox), and Bangladesh compliance exports are implemented and covered by integration tests.

**What to expect in beta:**

- Self-host and evaluate the full stack locally or on your own infrastructure
- Run real books for a single organisation with owner + team roles
- Export compliance worksheets — not automated NBR portal filing
- Payment integrations beyond test checkout and SSLCommerz sandbox are stubs (bKash/Nagad)
- Object storage is local filesystem; S3/R2 adapter is planned
- Receipt OCR and per-bank PDF parsers are not yet built

See [`RELEASE.md`](./RELEASE.md) for v0.1.0-beta.1 notes.

We welcome feedback, issues, and contributions. See [CONTRIBUTING.md](./CONTRIBUTING.md) and [SECURITY.md](./SECURITY.md).

**GitHub repo topics (suggested):** `accounting`, `open-source`, `invoicing`, `nestjs`, `nextjs`, `bangladesh`, `payroll`, `small-business`

| Area | Status |
|------|--------|
| Auth, org, RBAC, audit | Solid foundation |
| Ledger, journals, periods, trial balance | Core complete, tested |
| Sales (invoices, quotes, payments, PDFs) | Functional |
| Purchases (expenses, bills, suppliers) | Functional |
| Banking (CSV/PDF import, match, transfer) | Functional; PDF parser is heuristic |
| FX (rates, foreign invoices/payments) | Functional |
| Gateways (test + SSLCommerz sandbox) | Functional; bKash/Nagad are stubs |
| Bangladesh compliance (Mushak registers, TDS/VDS) | Export layer; no auto-submit |
| Payroll, people, assets, time | Functional |
| Web UI | Broad coverage |
| Tests | Ledger + API integration; no web E2E yet |

---

## Features

<details>
<summary><strong>Platform & security</strong></summary>

- **Multi-tenant data model** — workspace → organization; every query scoped by `organization_id`
- **Authentication** — email/password via [Better Auth](https://www.better-auth.com/); session cookies
- **RBAC** — `OWNER`, `ACCOUNTANT`, `MANAGER`, `EMPLOYEE`, `AUDITOR` with route-level gating
- **UI modes** — **Simple** (owner-friendly) and **Accountant** (journals, CoA, trial balance, month-end)
- **Audit log** — immutable action trail for sensitive operations
- **Document storage** — upload receipts, contracts, tax IDs; link to entities
- **Review queue** — drafts, unmatched bank lines, unsettled gateway captures, overdue AR/AP
- **Business setup wizard** — onboarding for business profile, IDs, bank, opening capital, invoice defaults
- **Command palette** — keyboard-first navigation (⌘K / Ctrl+K)

</details>

<details>
<summary><strong>Accounting core</strong></summary>

- **Chart of accounts** — seeded with VAT, TDS, VDS, FX, ERQ, gateway clearing accounts
- **Double-entry journals** — all postings through `AccountingPostingService`; `Decimal` money (no floats)
- **Accounting periods** — open / soft-close / lock
- **Opening balances & starting capital**
- **Journal reversal**
- **Trial balance, general ledger, month-end checklist**
- **Owner money** — capital contributions and drawings with automatic equity postings

</details>

<details>
<summary><strong>Sales & purchases</strong></summary>

- **Customers & suppliers** — business/individual/government types; TIN/BIN fields
- **Quotes → invoices → payments** — automatic AR/revenue/VAT postings; credit notes
- **Invoice PDFs** — Wave / classic / minimal templates; custom colors, logo, footer
- **Quick expenses & bills (AP)** — VAT, reverse-charge, ITC status, TDS/VDS withholding
- **Online checkout** — hosted pay page (`/pay/:token`); test gateway + SSLCommerz sandbox
- **Contracts & projects** — link commercial agreements and project codes to invoices

</details>

<details>
<summary><strong>Banking & FX</strong></summary>

- **Bank accounts** — link to ledger cash/bank accounts
- **CSV import** — `date, description, amount[, balance][, externalId]`
- **PDF statement import** — text extraction + heuristic row parser
- **Transaction matching** — suggest and match to invoices, bills, expenses
- **Inter-account transfers & reconciliation summary**
- **Multi-currency** — dated exchange rates, foreign invoices/payments, FX gain/loss posting

</details>

<details>
<summary><strong>Bangladesh compliance</strong></summary>

> **Disclaimer:** Avyro stores identifiers, calculates from configured rules, and exports Mushak-oriented registers. It is **not** legal or tax advice and does **not** auto-file with NBR or other government portals.

- **Compliance profile** — VAT registration flag, e-TIN, BIN, trade licence
- **Effective-dated tax codes** — VAT standard/reduced/zero, TDS, VDS
- **VAT documents** — Mushak 6.1 / 6.3 / 9.1 oriented records
- **Withholding entries & challans** — TDS/VDS deposit tracking
- **Registers & exports** — CSV/PDF for Mushak 6.1, 6.2.1, 6.3, 6.6, 6.7, 6.8, 6.10, 9.1; e-return evidence pack
- **Compliance reminders** — expiring licences and IDs

See [`docs/COMPLIANCE_BD.md`](./docs/COMPLIANCE_BD.md) for implementation notes.

</details>

<details>
<summary><strong>Reports, payroll & operations</strong></summary>

- **Dashboard** — revenue/expense/profit trend, cash, AR/AP aging buckets
- **Profit & loss, balance sheet, cash flow, AR/AP aging**
- **Excel export** — key reports downloadable as `.xlsx`
- **People / HR** — employee records, compensation, TDS %
- **Payroll** — periods, runs, journal posting, payslip PDFs
- **Assets** — register, straight-line depreciation
- **Time entries** — billable hours linked to projects

</details>

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Monorepo | pnpm workspaces |
| Web | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| API | NestJS 12, TypeScript |
| Worker | BullMQ + Redis (email jobs) |
| Database | PostgreSQL 16, Prisma 7 |
| Auth | Better Auth |
| PDF | PDFKit (invoices, payslips, Mushak registers), pdf-parse (bank statements) |
| Money | `decimal.js` |

---

## Quick start

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** 9.15 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- **Docker** (recommended) for PostgreSQL and Redis

### 1. Clone and install

```bash
git clone git@github.com:MiriyamCore/Avyro.git
cd Avyro
pnpm install
```

### 2. Environment

```bash
cp .env.example .env
```

Edit `.env` — set a strong `BETTER_AUTH_SECRET` for anything beyond local dev. See [Configuration](#configuration).

### 3. Database

```bash
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm db:seed    # dev only — creates demo org + owner user
```

### 4. Run

```bash
pnpm dev
```

| Service | URL |
|---------|-----|
| Web | http://localhost:3000 |
| API | http://localhost:3001 |

**Default seed login** (change before any shared environment):

| Field | Value |
|-------|-------|
| Email | `owner@demo.local` (or `SEED_OWNER_EMAIL`) |
| Password | `ChangeMeNow1!` (or `SEED_OWNER_PASSWORD`) |

### 5. Worker (optional)

Email notifications are queued from the API and processed by the worker. SMTP is optional — without it, the worker logs a stub.

```bash
pnpm --filter @avyro/worker dev
```

### Other commands

| Command | Description |
|---------|-------------|
| `pnpm build` | Build all packages and apps |
| `pnpm test` | Run unit + integration tests (requires `DATABASE_URL`) |
| `pnpm typecheck` | TypeScript check across workspace |
| `pnpm lint` | Lint |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm db:migrate:deploy` | Apply migrations (production) |
| `pnpm --filter @avyro/api dev` | API only |
| `pnpm --filter @avyro/web dev` | Web only |
| `pnpm --filter @avyro/accounting build` | Ledger package |
| `pnpm --filter @avyro/api exec vitest run` | API integration tests |

---

## Project structure

```text
avyro/
├── apps/
│   ├── api/              NestJS REST API
│   ├── web/              Next.js frontend (Simple + Accountant UI)
│   └── worker/           BullMQ worker (outbound email)
├── packages/
│   ├── accounting/       AccountingPostingService, ledger invariants
│   ├── database/         Prisma schema, migrations, seed
│   ├── validation/       Shared Zod schemas
│   ├── types/            Shared TypeScript types
│   └── ui/               Shared UI primitives
├── docs/                 Architecture, compliance, API, deployment guides
├── docker-compose.yml    PostgreSQL + Redis for local dev
└── .github/workflows/    CI (typecheck, test, build)
```

---

## Configuration

All variables are documented in [`.env.example`](./.env.example).

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes* | Redis for BullMQ (*required if using email queue) |
| `BETTER_AUTH_SECRET` | Yes | Session signing secret — use a long random string in production |
| `BETTER_AUTH_URL` | Yes | Public URL the browser uses |
| `API_URL` | Yes | API base URL |
| `WEB_URL` | Yes | Web app URL |
| `STORAGE_ROOT` | No | Local document storage path |
| `SMTP_*` | No | Outbound email |
| `SSLCOMMERZ_*` | No | SSLCommerz sandbox credentials |
| `SEED_*` | No | Dev seed user credentials |

Never commit `.env` or real secrets.

---

## Roadmap

### Near term

- [ ] Per-bank PDF parsers (BRAC, EBL, City, DBBL, etc.)
- [ ] Receipt OCR — auto-fill expense fields from uploaded images
- [ ] Live bKash / Nagad wallet checkout adapters
- [ ] S3/R2 object storage adapter
- [ ] Web E2E tests (Playwright)
- [ ] Worker in dev script — optional `pnpm dev:all`

### Compliance depth

- [ ] Deeper Mushak 6.3 tax-invoice PDF field mapping
- [ ] Credit/debit note workflows wired end-to-end in UI
- [ ] Automated VAT period reminders and filing calendar

### Platform (future)

- [ ] Public registration and workspace onboarding
- [ ] Subscription billing and usage limits
- [ ] Public API and webhooks
- [ ] Data importers and accountant portal

See [`avyro-SPEC.md`](./avyro-SPEC.md) and [`docs/PRODUCT.md`](./docs/PRODUCT.md) for the full plan.

---

## Development principles

1. **Scope all tenant data** by `organization_id`
2. **Post journals only** through `AccountingPostingService`
3. **Never use floating-point** for money — use `Decimal` / `db.Decimal`
4. **Never hard-code** tax rates or organisation-specific IDs — use effective-dated `tax_codes`

Additional docs:

- [`avyro-SPEC.md`](./avyro-SPEC.md) — product & engineering spec
- [`docs/COMPLIANCE_BD.md`](./docs/COMPLIANCE_BD.md) — Bangladesh compliance guide
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — system architecture
- [`docs/API.md`](./docs/API.md) — API overview
- [`docs/TESTING.md`](./docs/TESTING.md) — how to run tests

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a PR.

---

## Security

Report vulnerabilities privately — see [SECURITY.md](./SECURITY.md). Do not commit secrets or production data.

---

## License

[MIT License](./LICENSE) — Copyright (c) Miriyam Core.

---

## Author

Maintained by **[Miriyam Core](https://miriyamcore.com)** — [hello@miriyamcore.com](mailto:hello@miriyamcore.com)

---

## Acknowledgements

UX inspiration from **Wave** (simplicity for owners) and **Stripe** (structured money movement and reconciliation). Not affiliated with Wave Financial or Stripe, Inc.
