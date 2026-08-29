# ADR-007: Effective-dated compliance rules

## Status

Accepted

## Context

Bangladesh VAT/TDS/VDS/remittance rules change via SRO and circulars.

## Decision

Store compliance as effective-dated configuration. Never hard-code current rates into posting source.

## Consequences

Safer upgrades; requires accountant-reviewed seed/config before production filing.
