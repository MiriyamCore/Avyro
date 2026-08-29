# Deployment

Local: Docker Compose for Postgres + Redis; `pnpm dev` for apps.

Staging / production: containerise Web, API, Worker; managed Postgres + Redis; R2/S3 for documents.

Environments: `local`, `staging`, `production` — separate DBs and buckets.
