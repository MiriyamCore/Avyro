# Architecture

Modular monolith. Deployables: Web, API, Worker, PostgreSQL, Redis, Object Storage.

## Tenancy

```text
User → Workspace → Organisation → Business Data
```

Every tenant-owned table includes `organization_id`. Service methods always accept organisation context.

## Accounting boundary

Domain modules call `AccountingPostingService`. Controllers never write journal lines directly.

## Bangladesh compliance

Pluggable, effective-dated configuration. See [`COMPLIANCE_BD.md`](./COMPLIANCE_BD.md) and SPEC §151.

## ADRs

See [`adr/`](./adr/).
