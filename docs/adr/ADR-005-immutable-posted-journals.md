# ADR-005: Immutable posted journals

## Status

Accepted

## Context

Silent edits destroy auditability and period integrity.

## Decision

Posted journals cannot be edited in place. Corrections use reversal + new entry. Period locks block backdating.

## Consequences

Stronger audit trail; slightly more complex correction UX (acceptable).
