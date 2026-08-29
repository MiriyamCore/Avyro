'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { PageHeader, SearchField, StatusBadge } from '@/components/ui';

type Journal = {
  id: string;
  journalNumber: string;
  description: string;
  status: string;
  entryDate: string;
};

export default function JournalsPage() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    api<Journal[]>('/api/v1/journals')
      .then((rows) => setJournals(Array.isArray(rows) ? rows : []))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load journals'),
      );
  }, []);

  const filtered = useMemo(() => {
    return journals.filter((j) => {
      if (statusFilter !== 'ALL' && j.status !== statusFilter) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        j.journalNumber.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q) ||
        j.status.toLowerCase().includes(q) ||
        j.entryDate.slice(0, 10).includes(q)
      );
    });
  }, [journals, query, statusFilter]);

  return (
    <div className="ac-page">
      <PageHeader
        title="Journals"
        description="Posted ledger entries. Create business actions from Sales or Expenses — journals are the audit trail."
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {journals.length > 0 ? (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search number, description, date…"
          />
          <select
            className="ac-input max-w-xs"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All statuses</option>
            <option value="POSTED">Posted</option>
            <option value="DRAFT">Draft</option>
            <option value="REVERSED">Reversed</option>
            <option value="VOID">Void</option>
          </select>
        </div>
      ) : null}

      <div className="ac-card overflow-x-auto">
        <table className="ac-table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Date</th>
              <th>Description</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((j) => (
              <tr key={j.id}>
                <td className="font-mono text-xs">{j.journalNumber}</td>
                <td>{j.entryDate.slice(0, 10)}</td>
                <td className="font-medium">{j.description}</td>
                <td>
                  <StatusBadge status={j.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!error && journals.length === 0 ? (
          <p className="p-6 text-sm text-muted">No journals yet.</p>
        ) : null}
        {!error && journals.length > 0 && filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted">No journals match this search.</p>
        ) : null}
      </div>
    </div>
  );
}
