# ADR-001: Modular monolith

## Status

Accepted

## Context

Avyro is domain-heavy (ledger, payments, compliance) but early scale is a single organisation (Miriyam Core).

## Decision

Ship a modular monolith (Next.js web + NestJS API + worker) rather than microservices.

## Consequences

Clear module boundaries without distributed-system cost. Modules can be extracted later if needed.
