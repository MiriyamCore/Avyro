# ADR-006: Gateway clearing accounts

## Status

Accepted

## Context

Payment gateways settle net of fees; treating settlement as new revenue double-counts income.

## Decision

Customer payment hits gateway clearing; settlement moves clearing to bank and posts fees separately.

## Consequences

Correct revenue recognition; reconciliation UI must connect payment → settlement → bank.
