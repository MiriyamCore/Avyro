# ADR-002: Double-entry ledger

## Status

Accepted

## Context

Operational UI must stay simple, but books must be structurally correct.

## Decision

All financial effects post balanced journals through `AccountingPostingService`.

## Consequences

Users never write debits/credits in Simple Mode; accountants can inspect journals.
