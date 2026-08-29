'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { PageHeader } from '@/components/ui';

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  actorName?: string | null;
  createdAt: string;
};

type AuditResponse = {
  data: AuditRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    entityId: '',
    page: '1',
  });

  async function load(next?: Partial<typeof filters>) {
    const f = { ...filters, ...next };
    const params = new URLSearchParams();
    if (f.action) params.set('action', f.action);
    if (f.entityType) params.set('entityType', f.entityType);
    if (f.entityId) params.set('entityId', f.entityId);
    params.set('page', f.page);
    const data = await api<AuditResponse>(`/api/v1/audit?${params.toString()}`);
    setRows(data.data);
    setPagination({
      page: data.pagination.page,
      totalPages: data.pagination.totalPages,
      total: data.pagination.total,
    });
  }

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Unable to load audit log'),
    );
  }, []);

  function onFilter(event: FormEvent) {
    event.preventDefault();
    load({ ...filters, page: '1' }).catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Unable to load audit log'),
    );
  }

  return (
    <div className="ac-page">
      <PageHeader title="Audit log" description="Append-only history of significant actions." />
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <form onSubmit={onFilter} className="ac-card mb-4 grid gap-3 p-4 sm:grid-cols-4">
        <input
          className="ac-input"
          placeholder="Action"
          value={filters.action}
          onChange={(e) => setFilters({ ...filters, action: e.target.value })}
        />
        <input
          className="ac-input"
          placeholder="Entity type"
          value={filters.entityType}
          onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
        />
        <input
          className="ac-input"
          placeholder="Entity ID"
          value={filters.entityId}
          onChange={(e) => setFilters({ ...filters, entityId: e.target.value })}
        />
        <button type="submit" className="ac-btn-secondary">
          Filter
        </button>
      </form>

      <div className="ac-card divide-y divide-line">
        {rows.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 text-sm">
            <div>
              <span className="font-semibold">{row.action}</span> {row.entityType}
              {row.entityId ? (
                <span className="ml-2 font-mono text-xs text-muted">{row.entityId}</span>
              ) : null}
              {row.actorName ? (
                <span className="ml-2 text-xs text-muted">by {row.actorName}</span>
              ) : null}
            </div>
            <div className="text-xs text-muted">{new Date(row.createdAt).toLocaleString()}</div>
          </div>
        ))}
        {!error && rows.length === 0 ? (
          <p className="p-6 text-sm text-muted">No audit events yet.</p>
        ) : null}
      </div>

      {pagination.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} events)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="ac-btn-secondary text-xs"
              disabled={pagination.page <= 1}
              onClick={() => {
                const page = String(pagination.page - 1);
                setFilters((f) => ({ ...f, page }));
                load({ page });
              }}
            >
              Previous
            </button>
            <button
              type="button"
              className="ac-btn-secondary text-xs"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => {
                const page = String(pagination.page + 1);
                setFilters((f) => ({ ...f, page }));
                load({ page });
              }}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
