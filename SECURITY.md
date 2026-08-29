# Security Policy

## Supported versions

Avyro is in **public beta**. Security fixes are applied on the default branch. We recommend running the latest commit when self-hosting.

| Version | Supported |
|---------|-----------|
| `main` (beta) | Yes |
| Older tags | Best effort |

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report sensitive issues privately by emailing **[hello@miriyamcore.com](mailto:hello@miriyamcore.com)**, or open a **GitHub Security Advisory** if enabled for the repo.

Include:

- Description of the vulnerability and potential impact
- Steps to reproduce
- Affected components (API, web, worker, etc.)
- Any suggested fix, if you have one

We aim to acknowledge reports within a few business days and will coordinate disclosure once a fix is available.

## Security expectations for self-hosters

Avyro handles financial data. When deploying beyond local development:

1. **Set strong secrets** — generate a long random `BETTER_AUTH_SECRET`; never use the `.env.example` defaults.
2. **Never commit secrets** — `.env` is gitignored; do not paste credentials in issues or PRs.
3. **Use HTTPS** in production — set `BETTER_AUTH_URL` and `WEB_URL` to your public HTTPS origin.
4. **Restrict database access** — PostgreSQL should not be exposed to the public internet.
5. **Change seed credentials** — `pnpm db:seed` creates a demo owner; disable or replace before any shared environment.
6. **Keep dependencies updated** — run `pnpm install` and review Dependabot or manual updates regularly.

## Built-in security controls

- Session-based authentication (Better Auth) with HTTP-only cookies
- Role-based access control at the API layer (`OWNER`, `ACCOUNTANT`, `MANAGER`, `EMPLOYEE`, `AUDITOR`)
- Organisation scoping on every tenant query
- Immutable audit log for sensitive operations
- No secrets in frontend bundles
- Webhook signature validation for payment gateways (where implemented)

See [`docs/SECURITY.md`](./docs/SECURITY.md) for engineering notes and SPEC references.

## Out of scope for beta

- Automated penetration testing or formal SOC 2 compliance
- Bug bounty programme
- Guaranteed SLA on vulnerability response times

We appreciate responsible disclosure from the community.
