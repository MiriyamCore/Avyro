# ADR-003: PostgreSQL + Prisma

## Status

Accepted

## Context

Need reliable relational storage, migrations, and TypeScript types for money-accurate accounting data.

## Decision

Use PostgreSQL with Prisma ORM. Store money as `Decimal`/`NUMERIC`.

## Consequences

Strong typing and migrations; avoid float money; service-layer transactions for posting workflows.
