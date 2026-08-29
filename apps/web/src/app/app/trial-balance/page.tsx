'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Money, PageHeader } from '@/components/ui';

type TrialBalance = {
  rows: Array<{ code: string; name: string; debit: string; credit: string }>;
  totalDebit: string;
  totalCredit: string;
  balanced: boolean;
};

export default function TrialBalancePage() {
  const [data, setData] = useState<TrialBalance | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<TrialBalance>('/api/v1/reports/trial-balance')
      .then(setData)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load trial balance'),
      );
  }, []);

  return (
    <div className="ac-page">
      <PageHeader
        title="Trial balance"
        description="Every posted journal must keep this balanced."
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {!data && !error ? <p className="text-muted">Loading…</p> : null}
      {data ? (
        <>
          <div className="mb-4 flex flex-wrap gap-3 text-sm">
            <span className={data.balanced ? 'ac-badge-success' : 'ac-badge-danger'}>
              {data.balanced ? 'Balanced' : 'Out of balance'}
            </span>
            <span className="text-ink-soft">
              Debit <Money amount={data.totalDebit} /> · Credit{' '}
              <Money amount={data.totalCredit} />
            </span>
          </div>
          <div className="ac-card overflow-x-auto">
            <table className="ac-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th className="text-right">Debit</th>
                  <th className="text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.code}>
                    <td>
                      <span className="font-mono text-xs text-muted">{row.code}</span>{' '}
                      {row.name}
                    </td>
                    <td className="text-right">
                      <Money amount={row.debit} />
                    </td>
                    <td className="text-right">
                      <Money amount={row.credit} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
