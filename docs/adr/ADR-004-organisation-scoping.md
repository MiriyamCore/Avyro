# ADR-004: Multi-tenant-ready organisation scoping

## Status

Accepted

## Context

First customer is Miriyam Core, but SaaS is the future direction.

## Decision

Every tenant-owned row includes `organization_id`. Repositories require organisation context.

## Consequences

No schema redesign to add a second organisation. Workspace switching can stay hidden in V1.
