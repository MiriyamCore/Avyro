# Database

PostgreSQL + Prisma. Money as `NUMERIC`/`Decimal`. Timestamps in UTC; business dates modelled explicitly.

All tenant tables include `organization_id` and composite indexes starting with it where useful.
