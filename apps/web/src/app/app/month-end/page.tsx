'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { PageHeader, StatusBadge } from '@/components/ui';

type Check = {
  id: string;
  label: string;
  status: 'ok' | 'warn' | 'block';
  detail: string;
  href: string;
};

type MonthEnd = {
  period: {
    id: string;
    name: string;
    status: string;
    startDate: string;
    endDate: string;
  };
  checks: Check[];
  summary: {
    blockers: number;
    warnings: number;
    readyToLock: boolean;
  };
};

export default function MonthEndPage() {
  const [data, setData] = useState<MonthEnd | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);

  async function load() {
    const result = await api<MonthEnd>('/api/v1/month-end');
    setData(result);
  }

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Unable to load month-end checklist'),
    );
  }, []);

  async function lockPeriod() {
    if (!data) return;
    setLocking(true);
    setError(null);
    try {
      await api(`/api/v1/periods/${data.period.id}/lock`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not lock period');
    } finally {
      setLocking(false);
    }
  }

  const statusTone = (status: Check['status']) => {
    if (status === 'ok') return 'bg-success-soft/50';
    if (status === 'block') return 'bg-danger-soft/50';
    return 'bg-warning-soft/50';
  };

  return (
    <div className="ac-page">
      <PageHeader
        title="Month-end"
        description="Walk the checklist, clear blockers, then lock the period so the books stay clean."
        actions={
          data ? (
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={data.period.status} />
              {data.period.status === 'OPEN' ? (
                <button
                  type="button"
                  className="ac-btn-primary"
                  disabled={!data.summary.readyToLock || locking}
                  onClick={lockPeriod}
                >
                  {locking ? 'Locking…' : `Lock ${data.period.name}`}
                </button>
              ) : null}
            </div>
          ) : null
        }
      />

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      {!data ? (
        <p className="text-muted">Loading checklist…</p>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <div className="ac-card p-4">
              <div className="text-sm text-muted">Period</div>
              <div className="mt-1 text-xl font-semibold text-ink">{data.period.name}</div>
              <div className="mt-1 text-xs text-muted">
                {data.period.startDate.slice(0, 10)} → {data.period.endDate.slice(0, 10)}
              </div>
            </div>
            <div className="ac-card p-4">
              <div className="text-sm text-muted">Blockers</div>
              <div className="mt-1 text-xl font-semibold text-ink">{data.summary.blockers}</div>
              <div className="mt-1 text-xs text-muted">Must clear before lock</div>
            </div>
            <div className="ac-card p-4">
              <div className="text-sm text-muted">Warnings</div>
              <div className="mt-1 text-xl font-semibold text-ink">{data.summary.warnings}</div>
              <div className="mt-1 text-xs text-muted">Review before closing</div>
            </div>
          </div>

          <div className="space-y-3">
            {data.checks.map((check) => (
              <div
                key={check.id}
                className={`ac-card p-4 ${statusTone(check.status)}`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-semibold text-ink">{check.label}</div>
                    <p className="mt-1 text-sm text-ink-soft">{check.detail}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        check.status === 'ok'
                          ? 'ac-badge-success'
                          : check.status === 'block'
                            ? 'ac-badge-danger'
                            : 'ac-badge-warning'
                      }
                    >
                      {check.status === 'ok'
                        ? 'OK'
                        : check.status === 'block'
                          ? 'Blocker'
                          : 'Review'}
                    </span>
                    {check.href !== '/app/month-end' ? (
                      <Link href={check.href} className="ac-btn-secondary text-xs">
                        Open
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {data.summary.readyToLock ? (
            <p className="mt-6 text-sm text-ink-soft">
              Trial balance is clean and the period is open — you can lock {data.period.name}.
            </p>
          ) : data.period.status === 'LOCKED' ? (
            <p className="mt-6 text-sm text-ink-soft">
              {data.period.name} is locked. New postings for this month should be reviewed carefully.
            </p>
          ) : (
            <p className="mt-6 text-sm text-ink-soft">
              Clear blockers (and ideally warnings) before locking the period.
            </p>
          )}
        </>
      )}
    </div>
  );
}
